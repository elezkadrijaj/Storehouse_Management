using Infrastructure.Configurations;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Infrastructure.Data
{
    public class MyService
    {
        private readonly IMongoDatabase _database;

        public MyService(IMongoClient mongoClient, IOptions<MongoDbSettings> settings)
        {
            _database = mongoClient.GetDatabase(settings.Value.DatabaseName);
        }

        // Your methods to interact with MongoDB...
    }
}
