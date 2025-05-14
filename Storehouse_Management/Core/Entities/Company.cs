using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class Company
    {
        public int CompanyId { get; set; }
        public string Name { get; set; } 
        public string? Phone_Number { get; set; } 
        public string Numer_Biznesit { get; set; } 
        public string Email { get; set; } 
        public string? Address { get; set; } 
        public string? Industry { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
