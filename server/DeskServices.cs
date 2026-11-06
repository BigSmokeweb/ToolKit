using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using System.Net.Mail;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace LeadDesk;

public class DeskError(string message, int status = 400) : Exception(message) { public int Status { get; } = status; }
public static class Security
{
    public static string Email(string e, bool required = false) { e = e.Trim().ToLowerInvariant(); if (e == "" && !required) return e; if (e.Length > 254 || !MailAddress.TryCreate(e, out var a) || a.Address != e) throw new DeskError("Enter a valid email address."); return e; }
    public static string UserId(this HttpContext c) => c.Items["WorkspaceOwnerId"] as string ?? throw new DeskError("Workspace context is unavailable.", 500);
    public static async Task<Staff> Staff(this HttpContext c, DeskDb db) => await db.Staff.SingleOrDefaultAsync(x => x.Id == c.UserId() && x.Active) ?? throw new DeskError("Workspace owner is unavailable.", 500);
    public static async Task<Staff> Admin(this HttpContext c, DeskDb db) { var s = await c.Staff(db); if (s.Role != "Admin") throw new DeskError("Only an administrator can change this.", 403); return s; }
    public static object Public(Staff s) => new { s.Id, s.Name, s.Email, s.Role, s.Active };
}
public class SettingsService(DeskDb db, IDataProtectionProvider protection, IConfiguration config)
{
    readonly IDataProtector protector = protection.CreateProtector("LeadDesk.Secrets.v1");
    public static readonly HashSet<string> Secrets = ["geminiKey", "linkedinClientSecret"];
    public static readonly Dictionary<string, string> Defaults = new() { { "senderName", "NoLegalPaisa" }, { "inviteLimit", "15" }, { "targetCities", "Mumbai, Delhi, Gurugram, Noida, Bengaluru, Pune, Hyderabad, Jaipur, Ahmedabad, Chennai" }, { "retentionDays", "365" }, { "geminiModel", "gemini-3.1-flash-lite" }, { "aiDailyLimit", "50" }, { "linkedinClientId", "" }, { "linkedinCallback", "https://localhost:7443/auth/linkedin/callback" }, { "companyUrl", "" }, { "senderProfile", "" } };
    public async Task<string> Get(string key) { var row = await db.Settings.FindAsync(key); if (row != null) { if (!Secrets.Contains(key)) return row.Value; try { return protector.Unprotect(row.Value); } catch { return ""; } } return config[$"Secrets:{key}"] ?? (key == "geminiModel" ? config["Gemini:Model"] : null) ?? Defaults.GetValueOrDefault(key, ""); }
    public async Task Set(string key, string value) { var row = await db.Settings.FindAsync(key); if (row == null) { row = new() { Key = key }; db.Settings.Add(row); } row.Value = Secrets.Contains(key) ? protector.Protect(value) : value; }
    public async Task<Dictionary<string, object>> Public() { var result = new Dictionary<string, object>(); foreach (var key in Defaults.Keys) result[key] = await Get(key); foreach (var key in Secrets) result[key + "Configured"] = !string.IsNullOrWhiteSpace(await Get(key)); return result; }
}
public static class Leads
{
    public static readonly string[] Stages = ["New", "Qualified", "Contacted", "Replied", "Meeting", "Won", "Lost"];
    public static readonly string[] Signals = ["None", "Asked for help", "Closing or exiting", "Raised funding", "Hiring", "New company", "Posted on topic"];
    public static readonly Dictionary<string, int> CheckWeights = new() { { "identity", 25 }, { "role", 20 }, { "company", 20 }, { "contact", 15 }, { "signal", 20 } };
    public static string Url(string value, bool linkedin = false) { value = value.Trim(); if (value == "") return ""; if (!Uri.TryCreate(value, UriKind.Absolute, out var u) || u.Scheme != "https" || !string.IsNullOrEmpty(u.UserInfo)) throw new DeskError("Links must be valid HTTPS URLs."); if (linkedin && (!(u.Host == "linkedin.com" || u.Host.EndsWith(".linkedin.com", StringComparison.OrdinalIgnoreCase)) || !u.AbsolutePath.StartsWith("/in/"))) throw new DeskError("Use a LinkedIn profile URL beginning with https://www.linkedin.com/in/."); return linkedin ? "https://www.linkedin.com" + u.AbsolutePath.TrimEnd('/').ToLowerInvariant() : u.GetLeftPart(UriPartial.Path) + u.Query; }
    public static void Validate(LeadInput i)
    {
        if (string.IsNullOrWhiteSpace(i.Name) || i.Name.Trim().Length > 160) throw new DeskError("A name is required (up to 160 characters).");
        if (i.Title.Length > 250 || i.Company.Length > 200 || i.City.Length > 120 || i.Evidence.Length > 5000 || i.Notes.Length > 10000 || i.Source.Length > 1000) throw new DeskError("One of the lead fields is too long.");
        if (!Stages.Contains(i.Stage) || !Signals.Contains(i.Signal)) throw new DeskError("Choose a valid stage and buying signal.");
        Security.Email(i.Email); Url(i.LinkedInUrl, true); Url(i.SourceUrl);
        if (i.Checks?.Keys.Any(k => !CheckWeights.ContainsKey(k)) == true) throw new DeskError("Unknown verification check.");
        if (i.FollowUpAt.HasValue && i.FollowUpAt.Value.Year < 2020) throw new DeskError("Enter a valid follow-up date.");
    }
    public static void Apply(Lead l, LeadInput i, string actor, string cities)
    {
        l.Name = i.Name.Trim(); l.Title = i.Title.Trim(); l.Company = i.Company.Trim(); l.City = i.City.Trim(); l.LinkedInUrl = Url(i.LinkedInUrl, true); l.Email = Security.Email(i.Email); l.CategoryId = i.CategoryId; l.Signal = i.Signal; l.Evidence = i.Evidence.Trim(); l.Source = string.IsNullOrWhiteSpace(i.Source) ? "Manual entry" : i.Source.Trim(); l.SourceUrl = Url(i.SourceUrl); l.Notes = i.Notes; l.Stage = i.Stage; l.OwnerId = i.OwnerId; l.FollowUpAt = i.FollowUpAt?.ToUniversalTime(); l.Approved = i.Approved; l.DoNotContact = i.DoNotContact; l.IsSample = i.IsSample; l.UpdatedAt = DateTime.UtcNow;
        foreach (var (kind, _) in CheckWeights) { var check = l.Checks.SingleOrDefault(c => c.Kind == kind); if (check == null) { check = new() { Kind = kind, LeadId = l.Id }; l.Checks.Add(check); } var v = i.Checks?.GetValueOrDefault(kind) ?? false; if (v != check.Verified) { check.Verified = v; check.CheckedAt = v ? DateTime.UtcNow : null; check.CheckedBy = actor; } }
        Score(l, cities);
    }
    public static void Score(Lead l, string cities)
    {
        var t = l.Title.ToLowerInvariant(); var senior = Regex.IsMatch(t, @"\b(founder|cofounder|co-founder|ceo|chief|owner|partner|managing director)\b") ? 40 : Regex.IsMatch(t, @"\b(cto|cfo|ciso|director|head|vp|vice president|dpo)\b") ? 30 : Regex.IsMatch(t, @"\b(manager|lead|counsel)\b") ? 20 : 0;
        var signal = l.Signal switch { "Asked for help" => 35, "Closing or exiting" => 35, "Raised funding" => 30, "Hiring" => 25, "New company" => 20, "Posted on topic" => 15, _ => 0 };
        var city = cities.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).Any(x => x.Equals(l.City, StringComparison.OrdinalIgnoreCase)) ? 10 : 0;
        l.FitScore = senior + signal + (l.Email != "" ? 10 : 0) + (l.LinkedInUrl != "" ? 5 : 0) + city;
        l.CredibilityScore = l.Checks.Where(c => c.Verified).Sum(c => CheckWeights.GetValueOrDefault(c.Kind));
    }
    public static bool Duplicate(Lead l, LeadInput i) => (i.LinkedInUrl.Trim() != "" && l.LinkedInUrl == Url(i.LinkedInUrl, true)) || (i.Email.Trim() != "" && l.Email == Security.Email(i.Email)) || (i.Company.Trim() != "" && l.Name.Equals(i.Name.Trim(), StringComparison.OrdinalIgnoreCase) && l.Company.Equals(i.Company.Trim(), StringComparison.OrdinalIgnoreCase));
    public static async Task<Lead> Get(DeskDb db, string id, bool trash = false) => await db.Leads.Include(x => x.Checks).SingleOrDefaultAsync(x => x.Id == id && (trash || x.DeletedAt == null)) ?? throw new DeskError("Lead not found.", 404);
    public static void Editable(Staff staff, Lead lead) { if (staff.Role != "Admin" && lead.OwnerId != "" && lead.OwnerId != staff.Id) throw new DeskError("This lead belongs to another team member.", 403); }
}
public static class Discovery
{
    static string[] Terms(string? value)
    {
        var positive = Regex.Split(value ?? "", @"\s+NOT\s+", RegexOptions.IgnoreCase)[0];
        var terms = Regex.Split(positive, @",|;|\r?\n|\s+(?:OR|AND)\s+", RegexOptions.IgnoreCase).Select(x => Regex.Replace(x, "[\\\"()]", "").Trim()).Where(x => x != "").Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (terms.Length > 20 || terms.Any(x => x.Length > 160)) throw new DeskError("Use up to 20 concise roles and 20 keywords per search.");
        return terms;
    }
    static string Group(IEnumerable<string> terms)
    {
        var list = terms.Where(x => x != "").Select(x => x.Contains(' ') ? "\"" + x + "\"" : x).ToArray();
        return list.Length > 1 ? "(" + string.Join(" OR ", list) + ")" : list.FirstOrDefault() ?? "";
    }
    public static string[] PeopleQueries(SearchCriteria criteria)
    {
        var roles = Terms(criteria.Titles); var topics = Terms(criteria.Keywords);
        // Every entered term is covered without creating a long, restrictive Boolean query.
        var roleGroups = (roles.Length == 0 ? new[] { "" } : roles).Chunk(2);
        var topicGroups = (topics.Length == 0 ? new[] { "" } : topics).Chunk(2).ToArray();
        return roleGroups.SelectMany(r => topicGroups.Select(t => string.Join(' ', new[] { Group(r), Group(t) }.Where(x => x != "")))).Select(q => q == "" ? "Founder" : q).ToArray();
    }
    static string Or(string v) => string.Join(" OR ", v.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).Select(x => x.Contains(' ') ? "\"" + x.Replace("\"", "") + "\"" : x));
    public static object[] Links(SearchCriteria c)
    {
        var excludes = new List<string>(); if (c.RemoveSeekers) excludes.AddRange(["student", "intern", "fresher", "open to work"]); if (c.RemoveSellers) excludes.AddRange(["agency", "recruiter", "business coach"]); excludes.AddRange(c.Exclude.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries));
        var titles = Or(c.Titles); var keys = Or(c.Keywords + (!string.IsNullOrWhiteSpace(c.CompanyType) ? ", " + c.CompanyType : "")); var query = string.Join(" ", new[] { titles != "" ? $"({titles})" : "", keys != "" ? $"({keys})" : "", excludes.Count > 0 ? $"NOT ({Or(string.Join(',', excludes))})" : "" }.Where(x => x != ""));
        string Q(string x) => Uri.EscapeDataString(x); var network = c.Network is "F" or "S" or "O" ? "&network=" + Q("[\"" + c.Network + "\"]") : ""; var geo = c.City.Equals("India", StringComparison.OrdinalIgnoreCase) ? "&geoUrn=%5B%22102713980%22%5D" : "";
        var time = c.Time == "day" ? "past-24h" : c.Time == "month" ? "past-month" : "past-week"; var secs = c.Time == "day" ? 86400 : c.Time == "month" ? 2592000 : 604800; var p = Or(c.Phrases); if (p == "") p = Or(c.Keywords); var positive = string.Join(' ', new[] { titles != "" ? $"({titles})" : "", keys != "" ? $"({keys})" : "" }.Where(x => x != "")); var google = "site:linkedin.com/in " + positive + " " + c.City + " " + string.Join(' ', excludes.Select(x => "-" + (x.Contains(' ') ? "\"" + x + "\"" : x)));
        object Link(string name, string type, string description, string q, string url) => new { name, type, description, query = q, url };
        var peopleQueries = PeopleQueries(c);
        var broadQuery = Terms(c.Titles).FirstOrDefault() ?? Terms(c.Keywords).FirstOrDefault() ?? "Founder";
        var peopleLocation = geo == "" && !string.IsNullOrWhiteSpace(c.City) ? " " + c.City : "";
        string PeopleUrl(string q) => "https://www.linkedin.com/search/results/people/?keywords=" + Q(q + peopleLocation) + geo + "&origin=GLOBAL_SEARCH_HEADER";
        var variants = peopleQueries.Select((q, i) => new { label = "Combination " + (i + 1) + ": " + q, query = q + peopleLocation, url = PeopleUrl(q) }).ToArray();
        return [
         new { name = "People", type = "LinkedIn", description = "Search multiple roles and keywords together. Switch combinations to cover every entered term.", query = peopleQueries[0] + peopleLocation, url = PeopleUrl(peopleQueries[0]), variants },
         Link("People · broader search","LinkedIn","If results are empty, search by role only across all locations and connections.",broadQuery,"https://www.linkedin.com/search/results/people/?keywords="+Q(broadQuery)+"&origin=GLOBAL_SEARCH_HEADER"),
   Link("Recent posts","LinkedIn","Find people talking about the need now",p,"https://www.linkedin.com/search/results/content/?keywords="+Q(p)+"&datePosted="+Q("\""+time+"\"")+"&sortBy=%22date_posted%22"),
   Link("Hiring signals","LinkedIn","Companies hiring for the problem you solve",c.Jobs,"https://www.linkedin.com/jobs/search/?keywords="+Q(c.Jobs)+"&location="+Q(c.City)+"&f_TPR=r"+secs),
   Link("Companies","LinkedIn","Find accounts, then review their People tab",keys,"https://www.linkedin.com/search/results/companies/?keywords="+Q(keys)+"&origin=FACETED_SEARCH"+(c.Size!=""?"&companySize="+Q("[\""+c.Size+"\"]"):"")),
   Link("Sales Navigator","LinkedIn","Requires your own Sales Navigator subscription",query,"https://www.linkedin.com/sales/search/people?query="+Q("(keywords:"+query+")")),
   Link("Public profiles","Google","Find publicly indexed LinkedIn profiles",google,"https://www.google.com/search?q="+Q(google)),
   Link("Public posts","Google","Topic discussions outside your network",p,"https://www.google.com/search?q="+Q("site:linkedin.com/posts ("+p+") "+c.City)),
   Link("Business contacts","Google","Check contact details on company websites",keys,"https://www.google.com/search?q="+Q(keys+" "+c.City+" contact email")),
   Link("Funding & startup news","Sources","Funding announcements and company launches",keys,"https://www.google.com/search?q="+Q("(site:inc42.com OR site:entrackr.com OR site:yourstory.com) ("+keys+") "+c.City)),
   Link("Company records","Sources","Cross-check the company and its directors",keys,"https://www.google.com/search?q="+Q("(site:zaubacorp.com OR site:tofler.in OR site:thecompanycheck.com) ("+keys+") "+c.City)),
   Link("Business directories","Sources","Discover SMEs beyond LinkedIn",keys,"https://www.google.com/search?q="+Q("(site:indiamart.com OR site:justdial.com) ("+keys+") "+c.City)),
   Link("Latest news","Sources","Recent events worth reviewing",p,"https://www.google.com/search?tbm=nws&tbs=qdr:"+(c.Time=="month"?"m":c.Time=="day"?"d":"w")+"&q="+Q(p+" "+c.City))
        ];
    }
}
public static class Seed
{
    public static async Task<string> WorkspaceOwner(DeskDb db)
    {
        var setting = await db.Settings.FindAsync("workspaceOwnerId");
        var owner = setting == null ? null : await db.Staff.SingleOrDefaultAsync(x => x.Id == setting.Value && x.Active && x.Role == "Admin");
        owner ??= await db.Staff.Where(x => x.Active && x.Role == "Admin").OrderBy(x => x.CreatedAt).FirstOrDefaultAsync();
        if (owner == null)
        {
            owner = await db.Staff.SingleOrDefaultAsync(x => x.Email == "workspace@leaddesk.invalid");
            if (owner == null) { owner = new Staff { Name = "Workspace", Email = "workspace@leaddesk.invalid" }; db.Staff.Add(owner); }
            owner.Role = "Admin"; owner.Active = true;
        }
        if (setting == null) { setting = new AppSetting { Key = "workspaceOwnerId" }; db.Settings.Add(setting); }
        setting.Value = owner.Id;
        await db.SaveChangesAsync();
        return owner.Id;
    }

    public static async Task Initialize(DeskDb db)
    {
        await db.Database.EnsureCreatedAsync(); if (await db.Categories.AnyAsync()) return;
        db.Categories.AddRange(
         C("general", "Any other search", "Anyone you describe: partners, investors, vendors or clients", "Describe the business need", "Founder, Director", "business", "looking for recommendations", ""),
         C("virtual-counsel", "Virtual Legal Counsel", "Growing SMEs and startups without an in-house lawyer", "Contract questions, expansion or legal hiring", "Founder, CEO, COO", "startup, SME", "legal advice, contract review", "legal counsel"),
         C("protection", "Legal Protection Plan", "Private limited companies and LLPs needing CA, CS and legal support", "Compliance workload or an upcoming filing", "Founder, Director, CFO", "private limited, LLP", "company compliance, annual filing", "company secretary"),
         C("exit", "Founder's Exit", "Co-founders and directors leaving a company", "A founder exit, resignation or equity transfer", "Co-founder, Director", "startup, private limited", "founder exit, director resignation", ""),
         C("closure", "Company Closure", "Companies and startups winding down", "Closure, striking off or winding up", "Founder, Director, CFO", "startup, company", "company closure, winding down", ""),
         C("trademark", "Trademark Registration", "D2C founders and teams launching a brand", "New brand, product or trademark question", "Founder, Brand Head", "D2C, ecommerce, consumer brand", "launching our brand, trademark registration", "brand manager"),
         C("dpdp", "RAAJAH DPDP Compliance", "SaaS, fintech, healthtech and edtech holding customer data", "Privacy hiring, data incidents or DPDP discussions", "CTO, Data Protection Officer, Head of Compliance, CISO, Founder", "SaaS, fintech, healthtech", "DPDP Act compliance, DPDP Rules, data protection officer India", "data protection officer OR privacy counsel"),
         C("contracts", "E-stamped Contracts", "HR, operations and procurement teams signing agreements", "Hiring growth or high-volume contract operations", "Head of HR, COO, Procurement Head", "HR, operations, procurement", "employment agreement, vendor contracts", "HR operations"),
         C("funded", "Funded Startups", "Founders raising or closing an investment round", "Funding announcement or new investment", "Founder, CEO, CFO", "startup, venture backed", "raised funding, seed round, series A", "finance head"),
         C("professionals", "Professional Empanelment", "Lawyers, CAs and CSs who could join or refer work", "Collaboration or professional partnership", "Lawyer, Chartered Accountant, Company Secretary", "law firm, CA, CS", "professional collaboration, referral partner", ""));
        await db.SaveChangesAsync();
    }
    static Category C(string id, string name, string audience, string signal, string titles, string keywords, string phrases, string jobs) => new() { Id = id, Name = name, Audience = audience, Signal = signal, Titles = titles, Keywords = keywords, Phrases = phrases, Jobs = jobs };
}
