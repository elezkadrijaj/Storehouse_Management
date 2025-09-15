using Microsoft.EntityFrameworkCore.Migrations.Operations;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class Order
    {
        public int OrderId { get; set; }
        public string Status { get; set; } // e.g., "Created", "Billed", "ReadyForDelivery", "InTransit", "Completed", "Returned", "Cancelled"
        public DateTime Created {  get; set; }
        [Column(TypeName = "decimal(18, 2)")]
        public decimal TotalPrice { get; set; }

        public string? UserId { get; set; }
        public ApplicationUser? AppUsers { get; set; }

        public int? CompanyId { get; set; }
        public Company? Company { get; set; }

        public string? ClientName { get; set; }
        public string? ClientPhoneNumber { get; set; }

        public string? ShippingAddressStreet { get; set; }
        public string? ShippingAddressCity { get; set; }
        public string? ShippingAddressPostalCode { get; set; }
        public string? ShippingAddressCountry { get; set; }

        public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
        public ICollection<OrderStatusHistory> OrderStatusHistories { get; set; } = new List<OrderStatusHistory>();
        public OrderReturn? OrderReturn { get; set; }

        public virtual ICollection<OrderAssignment> OrderAssignments { get; set; } = new List<OrderAssignment>();
    }
}
