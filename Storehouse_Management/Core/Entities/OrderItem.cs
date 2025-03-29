using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class OrderItem
    {
        public int OrderItemId {  get; set; }
        public int Quantity {get; set; }
        public float Price { get; set; }
        
        public int? OrdersId { get; set; }

        public Order? Orders { get; set; }

        public string? ProductsId {  get; set; }

        public Product? Products { get; set; }
}
    }
