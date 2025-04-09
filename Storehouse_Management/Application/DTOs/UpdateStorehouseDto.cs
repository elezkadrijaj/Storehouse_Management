using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class UpdateStorehouseDto
    {
        public string StorehouseName { get; set; }
        public string Location { get; set; }
        public double Size_m2 { get; set; }

    }
}
