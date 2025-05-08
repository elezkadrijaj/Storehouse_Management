using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class OrderItemExportDto
    {
        public int OrderItemId { get; set; }
        public string? ProductsId { get; set; }
        public string? ProductName { get; set; }
        public int Quantity { get; set; }
        public double Price { get; set; }
        public double TotalItemPrice => Quantity * Price;
    }
}
