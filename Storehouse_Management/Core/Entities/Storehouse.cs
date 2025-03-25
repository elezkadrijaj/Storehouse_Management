using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class Storehouse
    {
        public int StorehouseId { get; set; }
        public string StorehouseName { get; set; }
        public string Location { get; set; }
        public double Size_m2 { get; set; }

        public int? CompaniesId { get; set; }
        public Company? Companies { get; set; }
    }
}
