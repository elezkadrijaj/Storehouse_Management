using Core.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class ScheduleDto
    {
        public int ScheduleId { get; set; }
        public string UserId { get; set; }
        public string StartDate { get; set; }
        public string EndDate { get; set; }
        public string BreakTime { get; set; }
    }
}
