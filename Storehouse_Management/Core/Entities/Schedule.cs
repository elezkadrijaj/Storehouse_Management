using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class Schedule
    {
        public int ScheduleId {  get; set; }
        public string UserId { get; set; }
        public ApplicationUser ApplicationUser { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public DateTime BreakTime { get; set; }

    }
}
