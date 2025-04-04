using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class OrderStatusHistory
    {
        public int OrderStatusHistoryId { get; set; }
        public string UpdatedByUserId { get; set; }
        public string Status { get; set; }
        public DateTime Timestamp { get; set; }
        public string? Description { get; set; }

        public int? OrdersId { get; set; }
        public Order Orders { get; set; }
    }
}
