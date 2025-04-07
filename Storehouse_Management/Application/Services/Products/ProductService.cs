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
    public class ProductService
    {
        private readonly IMongoCollection<Product> _products;
        private readonly IMongoCollection<Supplier> _suppliers;
        private readonly IMongoCollection<Category> _categories;
        private readonly IMongoDbSettings _mongoDbSettings;

        public ProductService(IMongoClient mongoClient, IMongoDbSettings mongoDbSettings)
        {
            _mongoDbSettings = mongoDbSettings;
            var database = mongoClient.GetDatabase(_mongoDbSettings.DatabaseName);
            _products = database.GetCollection<Product>("Products");
            _suppliers = database.GetCollection<Supplier>("Suppliers");
            _categories = database.GetCollection<Category>("Categories");

            CreateIndexIfNotExists(_products, Builders<Product>.IndexKeys.Ascending(p => p.SupplierId), "SupplierIdIndex");
            CreateIndexIfNotExists(_products, Builders<Product>.IndexKeys.Ascending(p => p.CategoryId), "CategoryIdIndex");
        }

        private void CreateIndexIfNotExists(IMongoCollection<Product> collection, IndexKeysDefinition<Product> keys, string indexName)
        {
            var indexModel = new CreateIndexModel<Product>(keys, new CreateIndexOptions { Name = indexName });

            if (!IndexExists(collection, indexName))
            {
                collection.Indexes.CreateOne(indexModel);
            }
        }

        private bool IndexExists(IMongoCollection<Product> collection, string indexName)
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

        public async Task CreateProductAsync(Product product)
        {
            try
            {
                await _products.InsertOneAsync(product);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error creating product: {ex.Message}");
                throw;
            }
        }

        public async Task<Product> GetProductByIdAsync(string id)
        {
            try
            {
                var product = await _products.Find(p => p.ProductId == id).FirstOrDefaultAsync();

                if (product != null)
                {
                    product.Supplier = await _suppliers.Find(s => s.SupplierId == product.SupplierId).FirstOrDefaultAsync();
                    product.Category = await _categories.Find(c => c.CategoryId == product.CategoryId).FirstOrDefaultAsync();
                }

                return product;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting product by ID: {ex.Message}");
                throw;
            }
        }

        public async Task<List<Product>> GetAllProductsAsync()
        {
            try
            {
                var products = await _products.Find(p => true).ToListAsync();

                foreach (var product in products)
                {
                    product.Supplier = await _suppliers.Find(s => s.SupplierId == product.SupplierId).FirstOrDefaultAsync();
                    product.Category = await _categories.Find(c => c.CategoryId == product.CategoryId).FirstOrDefaultAsync();
                }

                return products;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting all products: {ex.Message}");
                throw;
            }
        }

        public async Task UpdateProductAsync(string id, Product updatedProduct)
        {
            try
            {
                var result = await _products.ReplaceOneAsync(p => p.ProductId == id, updatedProduct);
                if (result.ModifiedCount == 0)
                {
                    Console.WriteLine($"Product with ID {id} not found for update.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error updating product: {ex.Message}");
                throw;
            }
        }

        public async Task DeleteProductAsync(string id)
        {
            try
            {
                var result = await _products.DeleteOneAsync(p => p.ProductId == id);
                if (result.DeletedCount == 0)
                {
                    Console.WriteLine($"Product with ID {id} not found for delete.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error deleting product: {ex.Message}");
                throw;
            }
        }
    }
}
