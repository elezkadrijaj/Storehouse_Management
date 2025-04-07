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
    public class CategoryService
    {
        private readonly IMongoCollection<Category> _categories;
        private readonly IMongoDbSettings _mongoDbSettings;

        public CategoryService(IMongoClient mongoClient, IMongoDbSettings mongoDbSettings)
        {
            _mongoDbSettings = mongoDbSettings;
            var database = mongoClient.GetDatabase(_mongoDbSettings.DatabaseName);
            _categories = database.GetCollection<Category>("Categories");

            CreateIndexIfNotExists(_categories, Builders<Category>.IndexKeys.Ascending(c => c.Name), "CategoryNameIndex");
        }

        private void CreateIndexIfNotExists(IMongoCollection<Category> collection, IndexKeysDefinition<Category> keys, string indexName)
        {
            var indexModel = new CreateIndexModel<Category>(keys, new CreateIndexOptions { Name = indexName });

            if (!IndexExists(collection, indexName))
            {
                collection.Indexes.CreateOne(indexModel);
            }
        }

        private bool IndexExists(IMongoCollection<Category> collection, string indexName)
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


        public async Task<List<Category>> GetAllCategoriesAsync()
        {
            try
            {
                return await _categories.Find(_ => true).ToListAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting all categories: {ex.Message}");
                throw;
            }
        }

        public async Task<Category> GetCategoryByIdAsync(string id)
        {
            try
            {
                return await _categories.Find(c => c.CategoryId == id).FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting category by ID: {ex.Message}");
                throw;
            }
        }

        public async Task CreateCategoryAsync(Category category)
        {
            try
            {
                await _categories.InsertOneAsync(category);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error creating category: {ex.Message}");
                throw;
            }
        }

        public async Task UpdateCategoryAsync(string id, Category category)
        {
            try
            {
                var result = await _categories.ReplaceOneAsync(c => c.CategoryId == id, category);
                if (result.ModifiedCount == 0)
                {
                    Console.WriteLine($"Category with ID {id} not found for update.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error updating category: {ex.Message}");
                throw;
            }
        }

        public async Task DeleteCategoryAsync(string id)
        {
            try
            {
                var result = await _categories.DeleteOneAsync(c => c.CategoryId == id);
                if (result.DeletedCount == 0)
                {
                    Console.WriteLine($"Category with ID {id} not found for deletion.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error deleting category: {ex.Message}");
                throw;
            }
        }
    }
}
