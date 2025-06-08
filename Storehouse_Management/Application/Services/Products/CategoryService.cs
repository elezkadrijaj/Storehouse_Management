using Application.Interfaces;
using Core.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Application.Services.Products
{
    public class CategoryService
    {
        private readonly IMongoCollection<Category> _categoriesCollection;
        private readonly IMongoDbSettings _mongoDbSettings;
        private readonly ILogger<CategoryService> _logger;

        public CategoryService(
            IMongoClient mongoClient,
            IMongoDbSettings mongoDbSettings,
            ILogger<CategoryService> logger)
        {
            _mongoDbSettings = mongoDbSettings;
            _logger = logger; 
            var database = mongoClient.GetDatabase(_mongoDbSettings.DatabaseName);
            _categoriesCollection = database.GetCollection<Category>("Categories");

            CreateIndexIfNotExists(_categoriesCollection,
                Builders<Category>.IndexKeys.Ascending(c => c.CompanyId).Ascending(c => c.Name),
                "CompanyId_Name_UniqueIndex",
                isUnique: true);

            CreateIndexIfNotExists(_categoriesCollection,
                Builders<Category>.IndexKeys.Ascending(c => c.CompanyId),
                "CompanyIdIndex");
        }

        private void CreateIndexIfNotExists(
            IMongoCollection<Category> collection,
            IndexKeysDefinition<Category> keys,
            string indexName,
            bool isUnique = false)
        {
            var indexOptions = new CreateIndexOptions { Name = indexName, Unique = isUnique };
            var indexModel = new CreateIndexModel<Category>(keys, indexOptions);

            try
            {
                if (!IndexExists(collection, indexName))
                {
                    collection.Indexes.CreateOne(indexModel);
                    _logger.LogInformation("Created MongoDB index: {IndexName} on collection {CollectionName}. Unique: {IsUnique}", indexName, collection.CollectionNamespace.CollectionName, isUnique);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create MongoDB index: {IndexName} on collection {CollectionName}", indexName, collection.CollectionNamespace.CollectionName);
            }
        }

        private bool IndexExists(IMongoCollection<Category> collection, string indexName)
        {
            try
            {
                using (var cursor = collection.Indexes.List())
                {
                    foreach (var indexDocument in cursor.ToEnumerable())
                    {
                        if (indexDocument["name"].AsString == indexName)
                        {
                            return true;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if index {IndexName} exists on collection {CollectionName}", indexName, collection.CollectionNamespace.CollectionName);
            }
            return false;
        }

        public async Task<List<Category>> GetAllCategoriesAsync(int companyId)
        {
            _logger.LogInformation("Service: GetAllCategoriesAsync called for CompanyId: {CompanyId}", companyId);
            try
            {
                var filter = Builders<Category>.Filter.Eq(c => c.CompanyId, companyId);
                return await _categoriesCollection.Find(filter).SortBy(c => c.Name).ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all categories for CompanyId: {CompanyId}", companyId);
                throw;
            }
        }

        public async Task<Category> GetCategoryByIdAsync(string id, int companyId)
        {
            _logger.LogInformation("Service: GetCategoryByIdAsync called for Id: {CategoryId}, CompanyId: {CompanyId}", id, companyId);
            try
            {
                var filter = Builders<Category>.Filter.And(
                    Builders<Category>.Filter.Eq(c => c.CategoryId, id),
                    Builders<Category>.Filter.Eq(c => c.CompanyId, companyId)
                );
                return await _categoriesCollection.Find(filter).FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting category by Id: {CategoryId} for CompanyId: {CompanyId}", id, companyId);
                throw;
            }
        }

        public async Task CreateCategoryAsync(Category category)
        {
            if (category.CompanyId <= 0)
            {
                _logger.LogError("Service: CreateCategoryAsync failed - CompanyId is invalid or not set. CompanyId: {CompanyId}", category.CompanyId);
                throw new ArgumentException("CompanyId must be set on the category.", nameof(category.CompanyId));
            }
            _logger.LogInformation("Service: CreateCategoryAsync called for Name: {CategoryName}, CompanyId: {CompanyId}", category.Name, category.CompanyId);
            try
            {
                category.CategoryId = null;
                await _categoriesCollection.InsertOneAsync(category);
                _logger.LogInformation("Category '{CategoryName}' created successfully with ID: {CategoryId} for CompanyId: {CompanyId}", category.Name, category.CategoryId, category.CompanyId);
            }
            catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
            {
                _logger.LogWarning(ex, "Error creating category '{CategoryName}' for CompanyId {CompanyId} due to duplicate key. Likely unique index violation (CompanyId, Name).", category.Name, category.CompanyId);
                throw new InvalidOperationException($"A category with the name '{category.Name}' already exists for this company.", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating category '{CategoryName}' for CompanyId {CompanyId}", category.Name, category.CompanyId);
                throw;
            }
        }

        public async Task<bool> UpdateCategoryAsync(string id, int companyId, Category categoryToUpdate)
        {
            if (id != categoryToUpdate.CategoryId)
            {
                _logger.LogWarning("Service: UpdateCategoryAsync - Mismatch between route ID '{RouteId}' and category body ID '{BodyId}'.", id, categoryToUpdate.CategoryId);
                return false;
            }
            if (companyId != categoryToUpdate.CompanyId)
            {
                _logger.LogWarning("Service: UpdateCategoryAsync - Attempt to change CompanyId or update category for wrong company. Original CompanyId: {OriginalCompanyId}, New CompanyId in body: {NewCompanyId}", companyId, categoryToUpdate.CompanyId);
                categoryToUpdate.CompanyId = companyId;
            }

            _logger.LogInformation("Service: UpdateCategoryAsync called for Id: {CategoryId}, CompanyId: {CompanyId}", id, companyId);
            try
            {
                var filter = Builders<Category>.Filter.And(
                    Builders<Category>.Filter.Eq(c => c.CategoryId, id),
                    Builders<Category>.Filter.Eq(c => c.CompanyId, companyId) 
                );

                var updatePayload = new Category
                {
                    CategoryId = id,
                    Name = categoryToUpdate.Name,
                    CompanyId = companyId
                };

                var result = await _categoriesCollection.ReplaceOneAsync(filter, updatePayload);
                if (result.IsAcknowledged && result.ModifiedCount > 0)
                {
                    _logger.LogInformation("Category with ID {CategoryId} updated successfully for CompanyId {CompanyId}.", id, companyId);
                    return true;
                }
                else if (result.IsAcknowledged && result.MatchedCount > 0 && result.ModifiedCount == 0)
                {
                    _logger.LogInformation("Category with ID {CategoryId} for CompanyId {CompanyId} was found but not modified (data might be the same).", id, companyId);
                    return true;
                }
                else
                {
                    _logger.LogWarning("Category with ID {CategoryId} not found for update under CompanyId {CompanyId}, or update was not acknowledged.", id, companyId);
                    return false;
                }
            }
            catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
            {
                _logger.LogWarning(ex, "Error updating category '{CategoryName}' (ID: {CategoryId}) for CompanyId {CompanyId} due to duplicate key.", categoryToUpdate.Name, id, companyId);
                throw new InvalidOperationException($"A category with the name '{categoryToUpdate.Name}' already exists for this company.", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating category with ID {CategoryId} for CompanyId {CompanyId}", id, companyId);
                throw;
            }
        }

        public async Task<bool> DeleteCategoryAsync(string id, int companyId)
        {
            _logger.LogInformation("Service: DeleteCategoryAsync called for Id: {CategoryId}, CompanyId: {CompanyId}", id, companyId);
            try
            {
                var filter = Builders<Category>.Filter.And(
                    Builders<Category>.Filter.Eq(c => c.CategoryId, id),
                    Builders<Category>.Filter.Eq(c => c.CompanyId, companyId)
                );
                var result = await _categoriesCollection.DeleteOneAsync(filter);

                if (result.IsAcknowledged && result.DeletedCount > 0)
                {
                    _logger.LogInformation("Category with ID {CategoryId} deleted successfully for CompanyId {CompanyId}.", id, companyId);
                    return true;
                }
                else
                {
                    _logger.LogWarning("Category with ID {CategoryId} not found for deletion under CompanyId {CompanyId}, or delete was not acknowledged.", id, companyId);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting category with ID {CategoryId} for CompanyId {CompanyId}", id, companyId);
                throw;
            }
        }
    }
}