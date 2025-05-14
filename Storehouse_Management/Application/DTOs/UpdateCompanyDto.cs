using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class UpdateCompanyDto
    {
        [Required]
        public string Name { get; set; }
        public string Phone_Number { get; set; }
        [Required]
        [EmailAddress]
        public string Email { get; set; }
        public string Address { get; set; }
        public string Industry { get; set; }
       
    }
}
