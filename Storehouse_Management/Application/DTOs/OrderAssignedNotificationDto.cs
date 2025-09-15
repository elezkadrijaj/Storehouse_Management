using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class OrderAssignedNotificationDto
    {
        public int OrderId { get; set; }
        public string ClientName { get; set; }
        public string Message { get; set; }
        public DateTime AssignedAt { get; set; }
    }
}
