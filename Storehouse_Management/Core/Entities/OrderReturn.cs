﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class OrderReturn
    {
        public int OrderReturnId { get; set; }
        public string Reason { get; set; }
        public string Status { get; set; }

        public int? OrderId { get; set; }
        public Order Orders { get; set; } = null!;
    }
}
