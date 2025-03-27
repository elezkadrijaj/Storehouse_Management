using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class Product
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string ProductId { get; set; }

        public string Name { get; set; }
        public string Stock { get; set; }
        public DateTime ExpiryDate { get; set; }
        public double Price { get; set; }

        [BsonRepresentation(BsonType.ObjectId)]
        public string SupplierId { get; set; }

        [BsonIgnore]
        public Supplier Supplier { get; set; }

        [BsonRepresentation(BsonType.ObjectId)]
        public string CategoryId { get; set; }

        [BsonIgnore]
        public Category Category { get; set; }
    }
}
