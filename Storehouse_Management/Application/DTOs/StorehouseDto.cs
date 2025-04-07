using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
     public class StorehouseDto
    {
        public int StorehouseId { get; set; }
        public string? Name { get; set; } = string.Empty;
        public string? Address { get; set; }
        public int? CompaniesId { get; set; }

    }
}
