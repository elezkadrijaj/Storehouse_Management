using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class ProductSearchParameters
    {
        // Filtering
        public string? FullTextTerm { get; set; }
        public double? MinPrice { get; set; }
        public double? MaxPrice { get; set; }
        public double? MinStock { get; set; }
        public DateTime? MinExpiryDate { get; set; }
        public DateTime? MaxExpiryDate { get; set; }
        public string? SupplierName { get; set; }
        public string? CategoryName { get; set; }
        public string? SectionName { get; set; }
        public string? StorehouseName { get; set; }
        public string? StorehouseLocation { get; set; }

        // Sorting
        public string? SortBy { get; set; } // e.g., "Name", "Price", "ExpiryDate", "Stock"
        public string? SortDirection { get; set; } // "ASC" or "DESC"

        // Pagination
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 10;

    }
}
