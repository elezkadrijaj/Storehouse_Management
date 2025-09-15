using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class OrderAssignment
    {
        public int OrderId { get; set; }
        public Order Order { get; set; }

        public string WorkerId { get; set; }
        public ApplicationUser Worker { get; set; }

        public DateTime AssignedAt { get; set; }
    }
}
