using Microsoft.EntityFrameworkCore.Migrations.Operations;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class Order
    {
        public int OrderId { get; set; }
        public string Status { get; set; }  
        public DateTime Created {  get; set; }
        public DateTime UpdatedAt {  get; set; }


        public string? UserId { get; set; }
        public ApplicationUser? AppUsers { get; set; }

    }
}
