using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace LeadDesk;

public class Staff
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    [MaxLength(160)] public string Name { get; set; } = "";
    [MaxLength(254)] public string Email { get; set; } = "";
    // Legacy column retained for existing database compatibility; account passwords are no longer used.
    public string PasswordHash { get; set; } = "";
    [MaxLength(20)] public string Role { get; set; } = "Staff";
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
public class Category
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    [MaxLength(120)] public string Name { get; set; } = "";
    public string Audience { get; set; } = "";
    public string Signal { get; set; } = "";
    public string Titles { get; set; } = "";
    public string Keywords { get; set; } = "";
    public string Phrases { get; set; } = "";
    public string Jobs { get; set; } = "";
}
public class Lead
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    [MaxLength(160)] public string Name { get; set; } = "";
    [MaxLength(250)] public string Title { get; set; } = "";
    [MaxLength(200)] public string Company { get; set; } = "";
    [MaxLength(120)] public string City { get; set; } = "";
    [MaxLength(1000)] public string LinkedInUrl { get; set; } = "";
    [MaxLength(254)] public string Email { get; set; } = "";
    [MaxLength(80)] public string CategoryId { get; set; } = "";
    [MaxLength(30)] public string Signal { get; set; } = "None";
    public string Evidence { get; set; } = "";
    public string Source { get; set; } = "";
    public string SourceUrl { get; set; } = "";
    public string Notes { get; set; } = "";
    [MaxLength(20)] public string Stage { get; set; } = "New";
    [MaxLength(80)] public string OwnerId { get; set; } = "";
    public DateTime? FollowUpAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeletedAt { get; set; }
    public bool Approved { get; set; }
    public bool DoNotContact { get; set; }
    public bool IsSample { get; set; }
    public int FitScore { get; set; }
    public int CredibilityScore { get; set; }
    public int Version { get; set; } = 1;
    public List<LeadCheck> Checks { get; set; } = [];
}
public class LeadCheck
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    [MaxLength(80)] public string LeadId { get; set; } = "";
    [MaxLength(40)] public string Kind { get; set; } = "";
    public bool Verified { get; set; }
    public DateTime? CheckedAt { get; set; }
    public string CheckedBy { get; set; } = "";
}
public class Outreach
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    [MaxLength(80)] public string LeadId { get; set; } = "";
    [MaxLength(80)] public string StaffId { get; set; } = "";
    [MaxLength(30)] public string Channel { get; set; } = "LinkedIn message";
    public string Subject { get; set; } = "";
    public string Message { get; set; } = "";
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}
public class Audit
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string StaffId { get; set; } = "";
    public string LeadId { get; set; } = "";
    public string Action { get; set; } = "";
    public string Detail { get; set; } = "";
    public DateTime At { get; set; } = DateTime.UtcNow;
}
public class AppSetting { [Key, MaxLength(100)] public string Key { get; set; } = ""; public string Value { get; set; } = ""; }
public class LinkedInAccount
{
    [Key, MaxLength(80)] public string StaffId { get; set; } = "";
    public string Sub { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string ProtectedToken { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}
public class SavedSearch
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string StaffId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Criteria { get; set; } = "{}";
    public bool Monitor { get; set; }
    public DateTime? LastRunAt { get; set; }
    public string LastError { get; set; } = "";
}
public class BuyingSignal
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string SearchId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Url { get; set; } = "";
    public string Snippet { get; set; } = "";
    public bool Reviewed { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
}
public class AiUsage
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string StaffId { get; set; } = "";
    public string Task { get; set; } = "";
    public string Status { get; set; } = "";
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
}
public class DeskDb(DbContextOptions<DeskDb> options) : DbContext(options)
{
    public DbSet<Staff> Staff => Set<Staff>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<LeadCheck> LeadChecks => Set<LeadCheck>();
    public DbSet<Outreach> OutreachLog => Set<Outreach>();
    public DbSet<Audit> AuditLog => Set<Audit>();
    public DbSet<AppSetting> Settings => Set<AppSetting>();
    public DbSet<LinkedInAccount> LinkedInAccounts => Set<LinkedInAccount>();
    public DbSet<SavedSearch> Searches => Set<SavedSearch>();
    public DbSet<BuyingSignal> Signals => Set<BuyingSignal>();
    public DbSet<AiUsage> AiUsage => Set<AiUsage>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Staff>().HasIndex(x => x.Email).IsUnique();
        b.Entity<Lead>().HasMany(x => x.Checks).WithOne().HasForeignKey(x => x.LeadId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Lead>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<Lead>().HasIndex(x => x.OwnerId);
        b.Entity<Lead>().HasIndex(x => x.DeletedAt);
        b.Entity<LeadCheck>().HasIndex(x => new { x.LeadId, x.Kind }).IsUnique();
        var utc = new ValueConverter<DateTime, DateTime>(value => value.ToUniversalTime(), value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
        foreach (var entity in b.Model.GetEntityTypes()) foreach (var property in entity.GetProperties()) if ((Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType) == typeof(DateTime)) property.SetValueConverter(utc);
    }
}
public record StaffRequest(string Name, string Email);
public record LeadInput(string Name = "", string Title = "", string Company = "", string City = "", string LinkedInUrl = "", string Email = "", string CategoryId = "", string Signal = "None", string Evidence = "", string Source = "", string SourceUrl = "", string Notes = "", string Stage = "New", string OwnerId = "", DateTime? FollowUpAt = null, bool Approved = false, bool DoNotContact = false, bool IsSample = false, int Version = 0, Dictionary<string, bool>? Checks = null);
public record OutreachInput(string Channel, string Subject, string Message, DateTime? FollowUpAt);
public record SearchCriteria(string Titles = "", string Keywords = "", string Phrases = "", string Jobs = "", string City = "India", string Network = "", string Time = "week", string CompanyType = "", string Size = "", string Exclude = "", bool RemoveSeekers = true, bool RemoveSellers = true, string CategoryId = "");
public record SearchInput(string Name, SearchCriteria Criteria, bool Monitor = false);
public record AiInput(string Text = "", string LeadId = "", string Channel = "LinkedIn message", string CategoryId = "");
