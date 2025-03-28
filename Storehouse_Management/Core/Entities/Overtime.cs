using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class Overtime
    {
        public int OvertimeId {  get; set; }
        public string UserId {  get; set; }
        public ApplicationUser ApplicationUser { get; set; }
        public DateTime Date { get; set; }
        public double HoursWorked {  get; set; }
       


    }
}
