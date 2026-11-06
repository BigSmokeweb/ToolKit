using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace LeadDesk;

public record CaptureInput(string Text = "", string SourceUrl = "");
public record PeopleCapturePerson(string Name = "", string Title = "", string Company = "", string City = "", string LinkedInUrl = "", string SourceText = "");
public record PeopleCaptureInput(List<PeopleCapturePerson>? People = null, string SourceUrl = "");
public record PairInput(string Code = "", string ExtensionId = "");
public record CaptureCredential(string TokenHash, string ExtensionId, DateTime PairedAt);
public record CapturePreparation(LeadInput Lead, string Relationship, string Assessment);

public class BrowserCaptureService(DeskDb db, IDataProtectionProvider protection)
{
    const string Key = "browserCaptureCredential";
    static readonly ConcurrentDictionary<string, DateTime> Codes = new();
    readonly IDataProtector protector = protection.CreateProtector("LeadDesk.BrowserCapture.v1");
    static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static bool ExtensionIdValid(string id) => Regex.IsMatch(id, "^[a-p]{32}$");
    public static bool IsExtensionRoute(PathString path) => path == "/api/browser-capture/pair" || path == "/api/browser-capture/import" || path == "/api/browser-capture/import-many" || path == "/api/browser-capture/status";
    public static string RequestExtension(HttpContext c)
    {
        var id = c.Request.Headers["X-Lead-Desk-Extension"].ToString();
        var origin = c.Request.Headers.Origin.ToString();
        if (!ExtensionIdValid(id) || (origin != "" && origin != "chrome-extension://" + id))
            throw new DeskError("This endpoint is reserved for the paired browser extension.", 403);
        return id;
    }
    public object NewCode()
    {
        Codes.Clear();
        var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
        var expires = DateTime.UtcNow.AddMinutes(10);
        Codes[Hash(code)] = expires;
        return new { code, expiresAt = expires };
    }
    async Task<CaptureCredential?> Credential()
    {
        var row = await db.Settings.FindAsync(Key);
        if (row == null || row.Value == "") return null;
        try { return JsonSerializer.Deserialize<CaptureCredential>(protector.Unprotect(row.Value)); }
        catch (Exception e) when (e is CryptographicException or JsonException) { return null; }
    }
    public async Task<object> Status()
    {
        var credential = await Credential();
        return new { paired = credential != null, extensionId = credential?.ExtensionId, pairedAt = credential?.PairedAt };
    }
    public async Task<object> Pair(PairInput input, HttpContext c)
    {
        var id = RequestExtension(c);
        if (input.ExtensionId != id || string.IsNullOrWhiteSpace(input.Code) || input.Code.Length > 200)
            throw new DeskError("Invalid pairing request.", 400);
        if (!Codes.TryRemove(Hash(input.Code.Trim()), out var expires) || expires < DateTime.UtcNow)
            throw new DeskError("The pairing code is invalid, expired or already used. Generate a new code in Lead Desk.", 403);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var row = await db.Settings.FindAsync(Key);
        if (row == null) { row = new AppSetting { Key = Key }; db.Settings.Add(row); }
        row.Value = protector.Protect(JsonSerializer.Serialize(new CaptureCredential(Hash(token), id, DateTime.UtcNow)));
        Leads.Audit(db, c.UserId(), "Paired browser capture extension");
        await db.SaveChangesAsync();
        return new { token, paired = true };
    }
    public async Task Authorize(HttpContext c)
    {
        var id = RequestExtension(c);
        var token = c.Request.Headers["X-Lead-Desk-Capture"].ToString();
        var credential = await Credential();
        if (token.Length is < 32 or > 200 || credential == null || credential.ExtensionId != id ||
            !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(credential.TokenHash), Encoding.ASCII.GetBytes(Hash(token))))
            throw new DeskError("Browser capture is not paired, or its access was revoked. Pair the extension again.", 403);
    }
    public async Task Revoke(HttpContext c)
    {
        Codes.Clear();
        var row = await db.Settings.FindAsync(Key);
        if (row != null) row.Value = "";
        Leads.Audit(db, c.UserId(), "Revoked browser capture access");
        await db.SaveChangesAsync();
    }
}

public static class CaptureRules
{
    public static List<LeadInput> PreparePeople(PeopleCaptureInput input)
    {
        if (input.People == null || input.People.Count is < 1 or > 100) throw new DeskError("Capture between 1 and 100 people from the current results page.");
        if (!Uri.TryCreate(input.SourceUrl, UriKind.Absolute, out var source) || source.Scheme != "https" || source.Host != "www.linkedin.com" || source.UserInfo != "" || source.Port != 443 || source.AbsolutePath.TrimEnd('/') != "/search/results/people") throw new DeskError("Bulk capture requires a LinkedIn People results page.");
        var result = new List<LeadInput>();
        foreach (var person in input.People)
        {
            if (person == null || string.IsNullOrWhiteSpace(person.Name) || person.Name.Length > 160 || person.SourceText == null || person.SourceText.Length > 6000 || person.SourceText.Trim().Length < 3) throw new DeskError("Each result needs a name and the displayed source text.");
            var text = Normalize(person.SourceText);
            if (!text.Contains(Normalize(person.Name), StringComparison.OrdinalIgnoreCase)) throw new DeskError("A captured name does not match its result card.");
            if (!Uri.TryCreate(person.LinkedInUrl, UriKind.Absolute, out var profile) || profile.Host is not ("www.linkedin.com" or "linkedin.com") || profile.Scheme != "https" || profile.UserInfo != "" || profile.Port != 443 || !Regex.IsMatch(profile.AbsolutePath, @"^/in/[^/]+/?$")) throw new DeskError("Each person needs their own LinkedIn profile URL.");
            string Fact(string? value, int max) => !string.IsNullOrWhiteSpace(value) && value.Length <= max && text.Contains(Normalize(value), StringComparison.OrdinalIgnoreCase) ? value.Trim() : "";
            var lead = new LeadInput(Name: person.Name.Trim(), Title: Fact(person.Title, 250), Company: Fact(person.Company, 200), City: Fact(person.City, 120), LinkedInUrl: Leads.Url(person.LinkedInUrl, true), CategoryId: "general", Signal: "None", Stage: "New", Source: "LinkedIn people results · user-triggered capture", SourceUrl: source.GetLeftPart(UriPartial.Path), Notes: "Captured from a displayed search result. Not verified; buying intent and current employer have not been inferred.\n\n" + person.SourceText.Trim(), Approved: false, Checks: new());
            Leads.Validate(lead); result.Add(lead);
        }
        return result;
    }
    public static bool Duplicate(Lead existing, LeadInput input) => Leads.Duplicate(existing, input) ||
        (input.SourceUrl != "" && existing.SourceUrl == input.SourceUrl && existing.Name.Equals(input.Name, StringComparison.OrdinalIgnoreCase));
    static string Normalize(string text) => Regex.Replace(text, @"\s+", " ").Trim();
    static string Get(JsonNode node, string field, int max = 1000)
    {
        if (node[field] is not JsonValue value || !value.TryGetValue<string>(out var text)) return "";
        text = text.Trim(); return text.Length <= max ? text : "";
    }
    public static void Validate(CaptureInput input)
    {
        if (string.IsNullOrWhiteSpace(input.Text) || input.Text.Length > 35000 ||
            Regex.Replace(input.Text, @"https?://\S+", "").Trim().Length < 12)
            throw new DeskError("Select the person's name, headline and relevant post text first. A profile URL alone cannot be imported.");
        var url = Leads.Url(input.SourceUrl);
        if (url != "")
        {
            var u = new Uri(url);
            if (u.Host != "www.linkedin.com" || !(u.AbsolutePath.StartsWith("/in/") || u.AbsolutePath.StartsWith("/posts/") || u.AbsolutePath.StartsWith("/feed/update/")))
                throw new DeskError("Capture is limited to LinkedIn profiles and individual posts.");
        }
    }
    public static CapturePreparation Prepare(JsonNode result, CaptureInput input, IEnumerable<Category> categories)
    {
        var text = Normalize(input.Text);
        bool Present(string value) => value != "" && text.Contains(Normalize(value), StringComparison.OrdinalIgnoreCase);
        string Fact(string key, int max) { var value = Get(result, key, max); return Present(value) ? value : ""; }
        var name = Fact("name", 160);
        if (name == "") throw new DeskError("No single identifiable person was found. Select that person's name, headline and post, then retry.", 422);
        var relationship = Get(result, "relationship");
        if (!new[] { "potential_buyer", "professional_partner", "unclear" }.Contains(relationship)) relationship = "unclear";
        var category = Get(result, "categoryId");
        if (relationship == "professional_partner") category = "professionals";
        if (!categories.Any(c => c.Id == category)) category = "general";
        var quote = Fact("supportingQuote", 3000);
        var signal = Get(result, "signal");
        if (!Leads.Signals.Contains(signal) || quote == "" || relationship == "unclear") signal = "None";
        // A professional publishing advice is not evidence that they are buying that advice.
        if (relationship == "professional_partner" && signal != "Posted on topic") signal = "None";
        var email = Fact("email", 254);
        try { email = Security.Email(email); } catch (DeskError) { email = ""; }
        var profile = Get(result, "linkedInUrl");
        if (!Present(profile)) profile = "";
        if (profile == "" && input.SourceUrl != "" && new Uri(input.SourceUrl).AbsolutePath.StartsWith("/in/")) profile = input.SourceUrl;
        try { profile = Leads.Url(profile, true); } catch (DeskError) { profile = ""; }
        var assessment = Get(result, "assessment", 1200);
        var lead = new LeadInput(Name: name, Title: Fact("title", 250), Company: Fact("company", 200), City: Fact("city", 120),
            LinkedInUrl: profile, Email: email, CategoryId: category, Signal: signal,
            Evidence: quote == "" ? "No buying signal confirmed in the supplied text." : "Source excerpt: " + quote,
            Source: "User-selected LinkedIn text via browser capture", SourceUrl: input.SourceUrl,
            Notes: "AI suggestion (not verified): " + relationship.Replace('_', ' ') + ". " + assessment,
            Approved: false, Checks: new());
        Leads.Validate(lead);
        return new(lead, relationship, assessment);
    }
}

public class CapturePreparationService(DeskDb db, GeminiService ai)
{
    public async Task<CapturePreparation> Prepare(CaptureInput input, string actor)
    {
        CaptureRules.Validate(input);
        var categories = await db.Categories.ToListAsync();
        var properties = new Dictionary<string, object>();
        foreach (var key in new[] { "name", "title", "company", "city", "linkedInUrl", "email", "categoryId", "signal", "supportingQuote", "assessment" }) properties[key] = GeminiService.Str;
        properties["relationship"] = new { type = "string", @enum = new[] { "potential_buyer", "professional_partner", "unclear" } };
        var result = await ai.Generate(actor, "browser capture", "Identify ONE primary person in the user-selected text, ignoring unrelated names. Copy factual fields exactly from the supplied text; leave unknown fields empty. Classify their relationship as potential_buyer, professional_partner, or unclear. A lawyer/consultant selling legal or privacy services normally belongs to Professional Empanelment, not a DPDP buyer category. A post explaining compliance is not a request to buy compliance. Only assign a buying signal supported by a short exact supportingQuote copied from the text; otherwise use None. Signal must be one of: " + string.Join(", ", Leads.Signals) + ". Choose categoryId from the supplied categories. Keep assessment under 500 characters and explain uncertainty. Do not verify checks, approve outreach or draft a message.",
            JsonSerializer.Serialize(new { selectedText = input.Text, sourceUrl = input.SourceUrl, categories = categories.Select(c => new { c.Id, c.Name, c.Audience }) }), GeminiService.Schema(properties));
        return CaptureRules.Prepare(result, input, categories);
    }
}
