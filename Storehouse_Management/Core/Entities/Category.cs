using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Bson;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class Category
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string CategoryId { get; set; }

        public string Name { get; set; } = string.Empty;

        [BsonElement("CompanyId")]
        [BsonIgnoreIfNull]
        public int? CompanyId { get; set; }

        [BsonIgnore]
        public Company Company { get; set; }
    }
}
