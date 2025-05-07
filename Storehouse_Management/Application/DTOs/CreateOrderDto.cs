using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class CreateOrderDto
    {
        [Required]
        [MinLength(1, ErrorMessage = "Order must have at least one item.")]
        public List<OrderItemDto> OrderItems { get; set; } = new List<OrderItemDto>();

        public string? UserId { get; set; }

        [MaxLength(200)]
        public string? ClientName { get; set; }

        [MaxLength(30)]
        [Phone]
        public string? ClientPhoneNumber { get; set; }

        [MaxLength(255)]
        public string? ShippingAddressStreet { get; set; }

        [MaxLength(100)]
        public string? ShippingAddressCity { get; set; }

        [MaxLength(20)]
        public string? ShippingAddressPostalCode { get; set; }

        [MaxLength(100)]
        public string? ShippingAddressCountry { get; set; }
    }
}
