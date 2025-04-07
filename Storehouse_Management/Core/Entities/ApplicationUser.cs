using Microsoft.AspNetCore.Identity;

namespace Core.Entities
{
    public class ApplicationUser : IdentityUser
    {
        public string Role { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
        public DateTime TokenCreated { get; set; }
        public DateTime TokenExpires { get; set; }

        public int? CompaniesId { get; set; }
        public Company? Companies { get; set; }

        public string? CompanyBusinessNumber { get; set; }

        public int? StorehouseId { get; set; }
        public Storehouse? Storehouses { get; set; }

        public string? StorehouseName { get; set; }
    }
}