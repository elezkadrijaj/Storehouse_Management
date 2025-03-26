using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class CompanyManagerDto
    {
        public string Id { get; set; }
        public string Username { get; set; }
        public string Email { get; set; }
        public string? CompanyBusinessNumber { get; set; }
        //Add CompaniesId if needed
        //public int? CompaniesId {get; set;}
    }
}
