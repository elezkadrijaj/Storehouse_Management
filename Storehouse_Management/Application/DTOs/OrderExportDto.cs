using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class OrderExportDto
    {
        public int OrderId { get; set; }
        public string Status { get; set; }
        public DateTime Created { get; set; }
        public decimal TotalPrice { get; set; }
        public string? UserId { get; set; }
        public string? UserName { get; set; }
        public string? ClientName { get; set; }
        public string? ClientPhoneNumber { get; set; }
        public string? ShippingAddressStreet { get; set; }
        public string? ShippingAddressCity { get; set; }
        public string? ShippingAddressPostalCode { get; set; }
        public string? ShippingAddressCountry { get; set; }
        public List<OrderItemExportDto> OrderItems { get; set; } = new List<OrderItemExportDto>();
    }
}
