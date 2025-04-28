using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class ProductSearchResultDto
    {
        public string ProductId { get; set; }
        public string Name { get; set; }
        public double Stock { get; set; }
        public DateTime ExpiryDate { get; set; }
        public double Price { get; set; }
        public string? Photo { get; set; }

        // Related Data (denormalized for the response)
        public string? SupplierId { get; set; }
        public string? SupplierName { get; set; }

        public string? CategoryId { get; set; }
        public string? CategoryName { get; set; }

        public int? SectionId { get; set; }
        public string? SectionName { get; set; }
        public string? StorehouseName { get; set; } // From Section's Storehouse
        public string? StorehouseLocation { get; set; } // From Section's Storehouse
    }
}
