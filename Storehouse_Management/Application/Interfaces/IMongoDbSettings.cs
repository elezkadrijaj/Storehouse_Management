using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.Interfaces
{
    public interface IMongoDbSettings
    {
        string ConnectionString { get; }
        string DatabaseName { get; }
    }
}
