using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class WorkContract
    {
        public int WorkContractId {  get; set; }
        public string UserId { get; set; }
        public ApplicationUser ApplicationUser { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public double Salary { get; set; }
        public string ContractFileUrl { get; set; }


    }
}
