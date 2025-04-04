using Application.Interfaces;
using Core.Entities;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.Services.Products
{
    public class SupplierService
    {
        private readonly IMongoCollection<Supplier> _suppliers;
        private readonly IMongoDbSettings _mongoDbSettings; // Inject the interface

        public SupplierService(IMongoClient mongoClient, IMongoDbSettings mongoDbSettings) // Inject the interface
        {
            _mongoDbSettings = mongoDbSettings;
            var database = mongoClient.GetDatabase(_mongoDbSettings.DatabaseName);
            _suppliers = database.GetCollection<Supplier>("Suppliers");

            //Create Index
            CreateIndexIfNotExists(_suppliers, Builders<Supplier>.IndexKeys.Ascending(s => s.Name), "SupplierNameIndex");
        }

        private void CreateIndexIfNotExists(IMongoCollection<Supplier> collection, IndexKeysDefinition<Supplier> keys, string indexName)
        {
            var indexModel = new CreateIndexModel<Supplier>(keys, new CreateIndexOptions { Name = indexName });

            if (!IndexExists(collection, indexName))
            {
                collection.Indexes.CreateOne(indexModel);
            }
        }

        private bool IndexExists(IMongoCollection<Supplier> collection, string indexName)
        {
            var filter = Builders<BsonDocument>.Filter.Eq("name", indexName);
            var options = new ListIndexesOptions { BatchSize = 1 };
            using (var cursor = collection.Indexes.List(options))
            {
                while (cursor.MoveNext())
                {
                    var indexes = cursor.Current.ToList();
                    return indexes.Any(i => i["name"].AsString == indexName);
                }
            }
            return false;
        }


        public async Task<List<Supplier>> GetAllSuppliersAsync()
        {
            try
            {
                return await _suppliers.Find(_ => true).ToListAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting all suppliers: {ex.Message}");
                throw;
            }
        }

        public async Task<Supplier> GetSupplierByIdAsync(string id)
        {
            try
            {
                return await _suppliers.Find(s => s.SupplierId == id).FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting supplier by ID: {ex.Message}");
                throw;
            }
        }

        public async Task CreateSupplierAsync(Supplier supplier)
        {
            try
            {
                await _suppliers.InsertOneAsync(supplier);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error creating supplier: {ex.Message}");
                throw;
            }
        }

        public async Task UpdateSupplierAsync(string id, Supplier supplier)
        {
            try
            {
                var result = await _suppliers.ReplaceOneAsync(s => s.SupplierId == id, supplier);
                if (result.ModifiedCount == 0)
                {
                    Console.WriteLine($"Supplier with ID {id} not found for update.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error updating supplier: {ex.Message}");
                throw;
            }
        }

        public async Task DeleteSupplierAsync(string id)
        {
            try
            {
                var result = await _suppliers.DeleteOneAsync(s => s.SupplierId == id);
                if (result.DeletedCount == 0)
                {
                    Console.WriteLine($"Supplier with ID {id} not found for deletion.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error deleting supplier: {ex.Message}");
                throw;
            }
        }
    }
}