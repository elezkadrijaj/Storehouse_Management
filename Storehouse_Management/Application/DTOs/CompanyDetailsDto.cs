using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class CompanyDetailsDto
    {
        public string Name { get; set; } = "Your Storehouse Inc."; 
        public string AddressLine1 { get; set; } = "123 Warehouse St.";
        public string AddressLine2 { get; set; } = "StoreCity, ST 12345";
        public string PhoneNumber { get; set; } = "(555) 123-4567";
        public string Email { get; set; } = "contact@yourstorehouse.com";
        public string Website { get; set; } = "www.yourstorehouse.com";
    }
}
