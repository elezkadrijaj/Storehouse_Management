using Microsoft.EntityFrameworkCore.Migrations.Operations;
using System;
using System.Collections.Generic;
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
        public decimal TotalPrice { get; set; }

        public string? UserId { get; set; }
        public ApplicationUser? AppUsers { get; set; }

        public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
        public ICollection<OrderStatusHistory> OrderStatusHistories { get; set; } = new List<OrderStatusHistory>();
        public OrderReturn? OrderReturn { get; set; }
    }
}
