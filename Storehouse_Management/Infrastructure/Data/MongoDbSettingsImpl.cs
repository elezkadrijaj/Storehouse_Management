using Application.Interfaces;
using Infrastructure.Configurations;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Infrastructure.Data
{
    public class MongoDbSettingsImpl : IMongoDbSettings
    {
        private readonly MongoDbSettings _settings;

        public MongoDbSettingsImpl(IOptions<MongoDbSettings> settings)
        {
            _settings = settings.Value;
        }

        public string ConnectionString => _settings.ConnectionString;
        public string DatabaseName => _settings.DatabaseName;
    }
}
