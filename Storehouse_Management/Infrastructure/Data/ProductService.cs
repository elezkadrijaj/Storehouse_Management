using Core.Entities;
using Infrastructure.Configurations;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Infrastructure.Data
{
    public class ProductService
    {
        private readonly IMongoCollection<Product> _products;
        private readonly IMongoCollection<Supplier> _suppliers;
        private readonly IMongoCollection<Category> _categories;

        public ProductService(IMongoClient mongoClient, IOptions<MongoDbSettings> settings)
        {
            var database = mongoClient.GetDatabase(settings.Value.DatabaseName);
            _products = database.GetCollection<Product>("Products");
            _suppliers = database.GetCollection<Supplier>("Suppliers");
            _categories = database.GetCollection<Category>("Categories");

            // Create indexes
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

        // Create a new product
        public async Task CreateProductAsync(Product product)
        {
            try
            {
                await _products.InsertOneAsync(product);
            }
            catch (Exception ex)
            {
                // Log the exception
                Console.WriteLine($"Error creating product: {ex.Message}");
                throw; // Re-throw the exception or handle it as needed
            }
        }

        // Get a product by ID
        public async Task<Product> GetProductByIdAsync(string id)
        {
            try
            {
                var product = await _products.Find(p => p.ProductId == id).FirstOrDefaultAsync();

                if (product != null)
                {
                    // Manually populate Supplier and Category (Alternative: use aggregation pipeline)
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

        // Get all products
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

        // Update a product
        public async Task UpdateProductAsync(string id, Product updatedProduct)
        {
            try
            {
                var result = await _products.ReplaceOneAsync(p => p.ProductId == id, updatedProduct);
                if (result.ModifiedCount == 0)
                {
                    // Handle the case where the product was not found
                    Console.WriteLine($"Product with ID {id} not found for update.");
                    // You might want to throw an exception here or return an error code
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error updating product: {ex.Message}");
                throw;
            }
        }

        // Delete a product
        public async Task DeleteProductAsync(string id)
        {
            try
            {
                var result = await _products.DeleteOneAsync(p => p.ProductId == id);
                if (result.DeletedCount == 0)
                {
                    // Handle the case where the product was not found
                    Console.WriteLine($"Product with ID {id} not found for delete.");
                    // You might want to throw an exception here or return an error code
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
