using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class WorkerDto
    {
        public string Id { get; set; }
        public int? CompaniesId { get; set; }
        public string Username { get; set; }
        public string Email { get; set; }
        public bool EmailConfirmed { get; set; }
        public string? CompanyName { get; set; }
        public string? CompanyBusinessNumber { get; set; }
    }
}
