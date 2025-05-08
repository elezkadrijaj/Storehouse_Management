using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class FlattenedOrderExportDto
    {
        public int OrderId { get; set; }
        public string OrderStatus { get; set; }
        public DateTime OrderCreated { get; set; }
        public decimal OrderTotalPrice { get; set; }
        public string? UserId { get; set; }
        public string? UserName { get; set; }
        public string? ClientName { get; set; }
        public string? ClientPhoneNumber { get; set; }
        public string? ShippingAddressStreet { get; set; }
        public string? ShippingAddressCity { get; set; }
        public string? ShippingAddressPostalCode { get; set; }
        public string? ShippingAddressCountry { get; set; }

        public int? OrderItemId { get; set; }
        public string? ProductsId { get; set; }
        public string? ProductName { get; set; }
        public int? ItemQuantity { get; set; }
        public double? ItemPrice { get; set; }
        public double? ItemTotal { get; set; }
    }
}
