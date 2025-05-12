using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class OrderStatusUpdateNotificationDto
    {
        public int OrderId { get; set; }
        public string NewStatus { get; set; }
        public string? OldStatus { get; set; }
        public string UpdatedByUserName { get; set; }
        public string? Description { get; set; }
        public DateTime Timestamp { get; set; }
    }
}
