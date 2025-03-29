using Core.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class OvertimeDto
    {
        public int OvertimeId { get; set; }
        public string UserId { get; set; }
        public DateTime Date { get; set; }
        public double HoursWorked { get; set; }

    }
}
