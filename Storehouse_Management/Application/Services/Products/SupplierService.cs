// Application.Services.Products.SupplierService.cs
using Application.Interfaces;
using Core.Entities;
using Microsoft.Extensions.Logging; // Recommended: Add logging
using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Application.Services.Products
{
    public class SupplierService // Consider implementing ISupplierService
    {
        private readonly IMongoCollection<Supplier> _suppliersCollection; // Renamed for clarity
        private readonly IMongoDbSettings _mongoDbSettings;
        private readonly ILogger<SupplierService> _logger; // Added Logger

        public SupplierService(
            IMongoClient mongoClient,
            IMongoDbSettings mongoDbSettings,
            ILogger<SupplierService> logger) // Added Logger
        {
            _mongoDbSettings = mongoDbSettings;
            _logger = logger;
            var database = mongoClient.GetDatabase(_mongoDbSettings.DatabaseName);
            _suppliersCollection = database.GetCollection<Supplier>("Suppliers");

            // Ensure indexes
            // Unique name per company:
            CreateIndexIfNotExists(_suppliersCollection,
                Builders<Supplier>.IndexKeys.Ascending(s => s.CompanyId).Ascending(s => s.Name),
                "CompanyId_SupplierName_UniqueIndex",
                isUnique: true);

            // Index for just CompanyId for efficient fetching of all suppliers for a company
            CreateIndexIfNotExists(_suppliersCollection,
                Builders<Supplier>.IndexKeys.Ascending(s => s.CompanyId),
                "CompanyIdSupplierIndex"); // Renamed for clarity
        }

        private void CreateIndexIfNotExists(
            IMongoCollection<Supplier> collection,
            IndexKeysDefinition<Supplier> keys,
            string indexName,
            bool isUnique = false)
        {
            var indexOptions = new CreateIndexOptions { Name = indexName, Unique = isUnique };
            var indexModel = new CreateIndexModel<Supplier>(keys, indexOptions);
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

        private bool IndexExists(IMongoCollection<Supplier> collection, string indexName)
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

        public async Task<List<Supplier>> GetAllSuppliersAsync(int companyId)
        {
            _logger.LogInformation("Service: GetAllSuppliersAsync called for CompanyId: {CompanyId}", companyId);
            try
            {
                var filter = Builders<Supplier>.Filter.Eq(s => s.CompanyId, companyId);
                return await _suppliersCollection.Find(filter).SortBy(s => s.Name).ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all suppliers for CompanyId: {CompanyId}", companyId);
                throw;
            }
        }

        public async Task<Supplier> GetSupplierByIdAsync(string id, int companyId)
        {
            _logger.LogInformation("Service: GetSupplierByIdAsync called for Id: {SupplierId}, CompanyId: {CompanyId}", id, companyId);
            try
            {
                var filter = Builders<Supplier>.Filter.And(
                    Builders<Supplier>.Filter.Eq(s => s.SupplierId, id),
                    Builders<Supplier>.Filter.Eq(s => s.CompanyId, companyId)
                );
                return await _suppliersCollection.Find(filter).FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting supplier by Id: {SupplierId} for CompanyId: {CompanyId}", id, companyId);
                throw;
            }
        }

        public async Task CreateSupplierAsync(Supplier supplier)
        {
            if (supplier.CompanyId <= 0)
            {
                _logger.LogError("Service: CreateSupplierAsync failed - CompanyId is invalid or not set. CompanyId: {CompanyId}", supplier.CompanyId);
                throw new ArgumentException("CompanyId must be set on the supplier.", nameof(supplier.CompanyId));
            }
            _logger.LogInformation("Service: CreateSupplierAsync called for Name: {SupplierName}, CompanyId: {CompanyId}", supplier.Name, supplier.CompanyId);
            try
            {
                supplier.SupplierId = null; // Ensure MongoDB generates the ID
                await _suppliersCollection.InsertOneAsync(supplier);
                _logger.LogInformation("Supplier '{SupplierName}' created successfully with ID: {SupplierId} for CompanyId: {CompanyId}", supplier.Name, supplier.SupplierId, supplier.CompanyId);
            }
            catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
            {
                _logger.LogWarning(ex, "Error creating supplier '{SupplierName}' for CompanyId {CompanyId} due to duplicate key (CompanyId, Name).", supplier.Name, supplier.CompanyId);
                throw new InvalidOperationException($"A supplier with the name '{supplier.Name}' already exists for this company.", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating supplier '{SupplierName}' for CompanyId {CompanyId}", supplier.Name, supplier.CompanyId);
                throw;
            }
        }

        public async Task<bool> UpdateSupplierAsync(string id, int companyId, Supplier supplierToUpdate)
        {
            if (id != supplierToUpdate.SupplierId)
            {
                _logger.LogWarning("Service: UpdateSupplierAsync - Mismatch between route ID '{RouteId}' and supplier body ID '{BodyId}'.", id, supplierToUpdate.SupplierId);
                return false;
            }
            if (companyId != supplierToUpdate.CompanyId)
            {
                _logger.LogWarning("Service: UpdateSupplierAsync - Attempt to update supplier for wrong company. Original CompanyId: {OriginalCompanyId}, Body CompanyId: {BodyCompanyId}", companyId, supplierToUpdate.CompanyId);
                supplierToUpdate.CompanyId = companyId; // Enforce original companyId
            }

            _logger.LogInformation("Service: UpdateSupplierAsync called for Id: {SupplierId}, CompanyId: {CompanyId}", id, companyId);
            try
            {
                var filter = Builders<Supplier>.Filter.And(
                    Builders<Supplier>.Filter.Eq(s => s.SupplierId, id),
                    Builders<Supplier>.Filter.Eq(s => s.CompanyId, companyId)
                );

                var updatePayload = new Supplier
                {
                    SupplierId = id,
                    Name = supplierToUpdate.Name,
                    ContactInfo = supplierToUpdate.ContactInfo,
                    CompanyId = companyId
                };

                var result = await _suppliersCollection.ReplaceOneAsync(filter, updatePayload);

                if (result.IsAcknowledged && result.ModifiedCount > 0)
                {
                    _logger.LogInformation("Supplier with ID {SupplierId} updated successfully for CompanyId {CompanyId}.", id, companyId);
                    return true;
                }
                else if (result.IsAcknowledged && result.MatchedCount > 0 && result.ModifiedCount == 0)
                {
                    _logger.LogInformation("Supplier with ID {SupplierId} for CompanyId {CompanyId} was found but not modified (data might be the same).", id, companyId);
                    return true;
                }
                else
                {
                    _logger.LogWarning("Supplier with ID {SupplierId} not found for update under CompanyId {CompanyId}, or update was not acknowledged.", id, companyId);
                    return false;
                }
            }
            catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
            {
                _logger.LogWarning(ex, "Error updating supplier '{SupplierName}' (ID: {SupplierId}) for CompanyId {CompanyId} due to duplicate key.", supplierToUpdate.Name, id, companyId);
                throw new InvalidOperationException($"A supplier with the name '{supplierToUpdate.Name}' already exists for this company.", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating supplier with ID {SupplierId} for CompanyId {CompanyId}", id, companyId);
                throw;
            }
        }

        public async Task<bool> DeleteSupplierAsync(string id, int companyId)
        {
            _logger.LogInformation("Service: DeleteSupplierAsync called for Id: {SupplierId}, CompanyId: {CompanyId}", id, companyId);
            try
            {
                // TODO: Check if any Products in MongoDB reference this SupplierId for this CompanyId.
                // If so, you might want to prevent deletion or handle it.
                // var productCheckFilter = Builders<Product>.Filter.And(
                // Builders<Product>.Filter.Eq(p => p.SupplierId, id),
                // /* Add CompanyId filter for products if products are company specific directly or via Section */
                // );
                // long productCount = await _productsCollection.CountDocumentsAsync(productCheckFilter); // Assuming you have _productsCollection here
                // if (productCount > 0)
                // {
                // _logger.LogWarning("Cannot delete supplier {SupplierId} for CompanyId {CompanyId} as it is in use by products.", id, companyId);
                // return false;
                // }

                var filter = Builders<Supplier>.Filter.And(
                    Builders<Supplier>.Filter.Eq(s => s.SupplierId, id),
                    Builders<Supplier>.Filter.Eq(s => s.CompanyId, companyId)
                );
                var result = await _suppliersCollection.DeleteOneAsync(filter);

                if (result.IsAcknowledged && result.DeletedCount > 0)
                {
                    _logger.LogInformation("Supplier with ID {SupplierId} deleted successfully for CompanyId {CompanyId}.", id, companyId);
                    return true;
                }
                else
                {
                    _logger.LogWarning("Supplier with ID {SupplierId} not found for deletion under CompanyId {CompanyId}, or delete was not acknowledged.", id, companyId);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting supplier with ID {SupplierId} for CompanyId {CompanyId}", id, companyId);
                throw;
            }
        }
    }
}