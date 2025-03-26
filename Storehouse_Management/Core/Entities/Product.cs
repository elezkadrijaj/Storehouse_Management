using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class Product
    {
        public int ProductId {  get; set; }
        public string Name { get; set; }
        public string Stock {  get; set; }
        public DateTime ExpiryDate {  get; set; }
        public double Price {  get; set; }

        public int SupplierId { get; set; }
        public Supplier Supplier { get; set; }//foreign key
        public int CategoryId { get; set; }
        public Category Category { get; set; }//foreign key

    }
}
