using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class LeaveRequest
    {
        public int LeaveRequestId {  get; set; }
        public string UserId { get; set; }
        public ApplicationUser ApplicationUser {  get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Status { get; set; }
        public string ManagerId { get; set; }
        public ApplicationUser ApplicationUserMenager { get; set; }




    }
}
