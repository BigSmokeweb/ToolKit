using LeadDesk;
using System.Text.Json.Nodes;

var source = "Priya Demo\nFounder & Managing Partner\nExample Legal LLP\nGreater Delhi Area\nData Privacy Lawyer\nI advise businesses on DPDP compliance.";
var input = new CaptureInput(source, "https://www.linkedin.com/in/priya-demo/?trk=example");
Category[] categories = [new() { Id = "general" }, new() { Id = "professionals" }, new() { Id = "dpdp" }];
JsonNode Result() => JsonNode.Parse("""
{"name":"Priya Demo","title":"Founder & Managing Partner","company":"Example Legal LLP","city":"Greater Delhi Area","email":"invented@example.test","linkedInUrl":"https://www.linkedin.com/in/invented","relationship":"professional_partner","categoryId":"dpdp","signal":"Asked for help","supportingQuote":"I advise businesses on DPDP compliance.","assessment":"Offers services; no buying need shown."}
""")!;
int passed = 0;
void Check(string name, Action test) { test(); passed++; Console.WriteLine("PASS " + name); }
void Assert(bool value) { if (!value) throw new Exception("Assertion failed"); }
void Reject(Action action) { try { action(); } catch (DeskError) { return; } throw new Exception("Expected validation error"); }
var prepared = CaptureRules.Prepare(Result(), input, categories);
Check("providers are routed to professional empanelment", () => Assert(prepared.Lead.CategoryId == "professionals"));
Check("offering advice does not become a request for help", () => Assert(prepared.Lead.Signal == "None"));
Check("invented contact email is discarded", () => Assert(prepared.Lead.Email == ""));
Check("profile URL comes from supplied source, not hallucination", () => Assert(prepared.Lead.LinkedInUrl == "https://www.linkedin.com/in/priya-demo"));
Check("capture never auto-approves or verifies a lead", () => Assert(!prepared.Lead.Approved && prepared.Lead.Stage == "New" && prepared.Lead.Checks!.Count == 0));
Check("facts keep the exact supplied location", () => Assert(prepared.Lead.City == "Greater Delhi Area"));
Check("an invented person is rejected", () => { var r = Result(); r["name"] = "Invented Name"; Reject(() => CaptureRules.Prepare(r, input, categories)); });
Check("unsupported company and role claims are discarded", () => { var r = Result(); r["company"] = "Made Up Ltd"; r["title"] = "CEO"; var p = CaptureRules.Prepare(r, input, categories); Assert(p.Lead.Company == "" && p.Lead.Title == ""); });
Check("unsupported source quotes cannot create a buying signal", () => { var r = Result(); r["relationship"] = "potential_buyer"; r["supportingQuote"] = "I need a lawyer"; Assert(CaptureRules.Prepare(r, input, categories).Lead.Signal == "None"); });
Check("unclear relationships do not assert buying intent", () => { var r = Result(); r["relationship"] = "unclear"; Assert(CaptureRules.Prepare(r, input, categories).Lead.Signal == "None"); });
Check("unknown categories fall back to general", () => { var r = Result(); r["relationship"] = "unclear"; r["categoryId"] = "made-up-category"; Assert(CaptureRules.Prepare(r, input, categories).Lead.CategoryId == "general"); });
Check("a URL alone is insufficient", () => Reject(() => CaptureRules.Validate(new("https://www.linkedin.com/in/priya-demo", input.SourceUrl))));
Check("private messages cannot be captured", () => Reject(() => CaptureRules.Validate(input with { SourceUrl = "https://www.linkedin.com/messaging/thread/123" })));
Check("lookalike domains cannot be captured", () => Reject(() => CaptureRules.Validate(input with { SourceUrl = "https://www.linkedin.com.evil.test/in/priya" })));
Check("extension origins are strictly constrained", () => Assert(BrowserCaptureService.ExtensionIdValid(new string('a', 32)) && !BrowserCaptureService.ExtensionIdValid("bad") && !BrowserCaptureService.ExtensionIdValid(new string('z', 32))));
Check("repeat captures from a post deduplicate even without a company", () => Assert(CaptureRules.Duplicate(new Lead { Name = "Priya Demo", SourceUrl = "https://www.linkedin.com/feed/update/urn:li:activity:123" }, new LeadInput(Name: "Priya Demo", SourceUrl: "https://www.linkedin.com/feed/update/urn:li:activity:123"))));
Check("different people in the same post remain separate", () => Assert(!CaptureRules.Duplicate(new Lead { Name = "Priya Demo", SourceUrl = "https://www.linkedin.com/feed/update/urn:li:activity:123" }, new LeadInput(Name: "Another Person", SourceUrl: "https://www.linkedin.com/feed/update/urn:li:activity:123"))));
Check("people queries cover all roles and topics with bounded Boolean combinations", () => {
    var queries = Discovery.PeopleQueries(new(Titles: "CTO, Founder, Data Protection Officer, CISO, Head of Compliance", Keywords: "SaaS, fintech, healthtech"));
    Assert(queries.Length == 6);
    foreach (var term in new[] { "CTO", "Founder", "Data Protection Officer", "CISO", "Head of Compliance", "SaaS", "fintech", "healthtech" }) Assert(queries.Any(q => q.Contains(term)));
    Assert(queries.All(q => System.Text.RegularExpressions.Regex.Matches(q, @"\bOR\b").Count <= 2 && !q.Contains("NOT")));
    Assert(queries[0] == "(CTO OR Founder) (SaaS OR fintech)");
});
Check("people searches deduplicate terms and quote multiword roles", () => {
    var queries = Discovery.PeopleQueries(new(Titles: "CTO, cto, Head of Compliance", Keywords: "SaaS"));
    Assert(queries.Length == 1 && queries[0] == "(CTO OR \"Head of Compliance\") SaaS");
});
Check("large keyword lists are rejected instead of silently discarding terms", () => Reject(() => Discovery.PeopleQueries(new(Titles: string.Join(',', Enumerable.Range(1,21).Select(i => "Role" + i))))));
Check("draft context includes captured profile details and source notes", () => {
    var lead = new Lead { Name = "Asha Test", Title = "Website Developer", Company = "Example Co", City = "Mumbai", Notes = "Builds accessible React applications", SourceUrl = "https://www.linkedin.com/search/results/people/" };
    OutreachDrafting.Validate(lead, "LinkedIn message");
    var context = OutreachDrafting.Context(lead, "LinkedIn message", "NoLegalPaisa", "Professional collaboration");
    Assert(context.Contains("Website Developer") && context.Contains("accessible React") && context.Contains("Mumbai") && context.Contains("NoLegalPaisa"));
});
Check("unapproved leads may be drafted without approving outreach", () => OutreachDrafting.Validate(new Lead { Approved = false }, "Email"));
Check("do-not-contact and sample restrictions still apply to drafts", () => { Reject(() => OutreachDrafting.Validate(new Lead { DoNotContact = true }, "Email")); Reject(() => OutreachDrafting.Validate(new Lead { IsSample = true }, "Email")); });
Check("drafts reject unsupported channels", () => Reject(() => OutreachDrafting.Validate(new Lead(), "Direct API send")));
Console.WriteLine($"{passed} capture and drafting checks passed.");
