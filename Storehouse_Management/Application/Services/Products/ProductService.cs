﻿using Application.Interfaces;
using Core.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
        private readonly IAppDbContext _context;
        private readonly IMongoDbSettings _mongoDbSettings;
        private readonly ILogger<ProductService> _logger;
        private readonly IWebHostEnvironment _hostEnvironment;
        private const string ProductCollectionName = "Products";

        public ProductService(IMongoClient mongoClient, IMongoDbSettings mongoDbSettings, IAppDbContext context, ILogger<ProductService> logger, IWebHostEnvironment hostEnvironment)
        {
            _mongoDbSettings = mongoDbSettings;
            var database = mongoClient.GetDatabase(_mongoDbSettings.DatabaseName);
            _products = database.GetCollection<Product>("Products");
            _suppliers = database.GetCollection<Supplier>("Suppliers");
            _categories = database.GetCollection<Category>("Categories");
            _context = context;
            _logger = logger;
            _hostEnvironment = hostEnvironment;

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

        public async Task<Dictionary<string, string>> GetProductNamesAsync(IEnumerable<string> productIds)
        {
            if (productIds == null || !productIds.Any())
            {
                _logger.LogInformation("GetProductNamesAsync called with no product IDs.");
                return new Dictionary<string, string>();
            }

            var distinctProductIds = productIds
                .Where(id => !string.IsNullOrEmpty(id))
                .Distinct()
                .ToList();

            if (!distinctProductIds.Any())
            {
                _logger.LogInformation("GetProductNamesAsync: No valid distinct product IDs after filtering.");
                return new Dictionary<string, string>();
            }

            _logger.LogInformation("Fetching names for {Count} distinct product IDs.", distinctProductIds.Count);

            try
            {
                var filter = Builders<Product>.Filter.In(p => p.ProductId, distinctProductIds);
                var productsFromDb = await _products.Find(filter)
                                             .Project(p => new { p.ProductId, p.Name })
                                             .ToListAsync();

                _logger.LogInformation("Retrieved {Count} products from DB for name lookup.", productsFromDb.Count);

                return productsFromDb.ToDictionary(
                    p => p.ProductId,
                    p => p.Name ?? "N/A"
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching product names for IDs: {ProductIds}", string.Join(",", distinctProductIds));
                return distinctProductIds.ToDictionary(id => id, id => "Error Fetching Name");
            }
        }

        public async Task CreateProductAsync(Product product, IFormFile? photoFile)
        {
            string? relativePhotoPath = null;
            if (photoFile != null && photoFile.Length > 0)
            {
                try
                {
                    var uploadsFolder = Path.Combine(_hostEnvironment.WebRootPath ?? _hostEnvironment.ContentRootPath, "images", "products");
                    Directory.CreateDirectory(uploadsFolder);

                    var uniqueFileName = $"{Guid.NewGuid()}{Path.GetExtension(photoFile.FileName)}";
                    var absoluteFilePath = Path.Combine(uploadsFolder, uniqueFileName);

                    using (var fileStream = new FileStream(absoluteFilePath, FileMode.Create))
                    {
                        await photoFile.CopyToAsync(fileStream);
                    }

                    relativePhotoPath = Path.Combine("images", "products", uniqueFileName).Replace(Path.DirectorySeparatorChar, '/');
                    if (!relativePhotoPath.StartsWith("/"))
                    {
                        relativePhotoPath = "/" + relativePhotoPath;
                    }
                    _logger.LogInformation("Product photo saved to: {FilePath}", absoluteFilePath);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error saving product photo for product name: {ProductName}", product.Name);
                    throw new InvalidOperationException("Failed to save product photo.", ex);
                }
            }
            else
            {
                _logger.LogInformation("No photo provided for product name: {ProductName}", product.Name);
            }

            product.Photo = relativePhotoPath;
            product.ProductId = null;

            try
            {
                await _products.InsertOneAsync(product);
                _logger.LogInformation("Product {ProductName} created successfully with ID: {ProductId}", product.Name, product.ProductId);
            }
            catch (MongoWriteException ex)
            {
                _logger.LogError(ex, "MongoDB Error creating product {ProductName}", product.Name);

                if (!string.IsNullOrEmpty(relativePhotoPath))
                {
                    try
                    {
                        string webRootPath = _hostEnvironment.WebRootPath ?? _hostEnvironment.ContentRootPath;
                        string absoluteFilePath = Path.Combine(webRootPath, relativePhotoPath.TrimStart('/'));
                        if (File.Exists(absoluteFilePath))
                        {
                            File.Delete(absoluteFilePath);
                            _logger.LogWarning("Rolled back photo save due to DB error: {FilePath}", absoluteFilePath);
                        }
                    }
                    catch (Exception cleanupEx)
                    {
                        _logger.LogError(cleanupEx, "Error during photo cleanup after DB save failure for path: {PhotoPath}", relativePhotoPath);
                    }
                }
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Generic Error creating product {ProductName}", product.Name);
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

        public async Task<List<Product>> GetAllProductsAsync(int? companyId = null)
        {
            _logger.LogInformation("Service: GetAllProductsAsync called. Requested CompanyId: {CompanyId}", companyId.HasValue ? companyId.Value.ToString() : "N/A");
            try
            {
                List<Product> products;

                if (companyId.HasValue)
                {
                    _logger.LogDebug("Filtering by CompanyId: {CompanyId}. Finding relevant SectionIds from SQL DB.", companyId.Value);
                    // 1. Find SectionIDs belonging to the target company from SQL DB
                    var sectionIdsForCompany = await _context.Sections
                        .Where(s => s.Storehouses != null && s.Storehouses.CompaniesId == companyId.Value) // Ensure Storehouses is not null before accessing CompaniesId
                        .Select(s => s.SectionId)
                        .Distinct()
                        .ToListAsync();

                    if (!sectionIdsForCompany.Any())
                    {
                        _logger.LogInformation("No sections found associated with CompanyId: {CompanyId}. Returning empty product list.", companyId.Value);
                        return new List<Product>(); // No sections for this company, so no products
                    }
                    _logger.LogDebug("Found {Count} SectionId(s) for CompanyId {CompanyId}: [{SectionIds}]",
                        sectionIdsForCompany.Count, companyId.Value, string.Join(", ", sectionIdsForCompany));

                    // 2. Fetch products from MongoDB that belong to these sections
                    var productFilter = Builders<Product>.Filter.In(nameof(Product.SectionId), sectionIdsForCompany.Cast<int?>()); // Cast to int? to match Product.SectionId type
                    products = await _products.Find(productFilter).ToListAsync();
                    _logger.LogInformation("Fetched {ProductCount} product(s) from MongoDB for CompanyId {CompanyId} based on its SectionIds.", products.Count, companyId.Value);
                }
                else
                {
                    // No company filter, fetch all products.
                    // WARNING: This can be very resource-intensive for large product catalogs.
                    // Consider implementing pagination here if a "fetch all" scenario is common.
                    _logger.LogInformation("No CompanyId filter provided. Fetching all products from MongoDB.");
                    products = await _products.Find(p => true).ToListAsync();
                    _logger.LogInformation("Fetched {ProductCount} total product(s) from MongoDB.", products.Count);
                }

                if (!products.Any())
                {
                    _logger.LogInformation("No products found matching the criteria.");
                    return products; // Return empty list
                }

                // 3. Populate related data (Suppliers, Categories, Sections) for the fetched products

                // Populate Suppliers
                var supplierIds = products.Select(p => p.SupplierId).Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();
                if (supplierIds.Any())
                {
                    var suppliers = await _suppliers.Find(s => supplierIds.Contains(s.SupplierId)).ToListAsync();
                    var supplierDict = suppliers.ToDictionary(s => s.SupplierId);
                    foreach (var product in products)
                    {
                        if (!string.IsNullOrEmpty(product.SupplierId) && supplierDict.TryGetValue(product.SupplierId, out var supplier))
                        {
                            product.Supplier = supplier;
                        }
                    }
                    _logger.LogDebug("Populated Supplier details for the fetched products.");
                }

                // Populate Categories
                var categoryIds = products.Select(p => p.CategoryId).Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();
                if (categoryIds.Any())
                {
                    var categories = await _categories.Find(c => categoryIds.Contains(c.CategoryId)).ToListAsync();
                    var categoryDict = categories.ToDictionary(c => c.CategoryId);
                    foreach (var product in products)
                    {
                        if (!string.IsNullOrEmpty(product.CategoryId) && categoryDict.TryGetValue(product.CategoryId, out var category))
                        {
                            product.Category = category;
                        }
                    }
                    _logger.LogDebug("Populated Category details for the fetched products.");
                }

                // Populate Sections (and their nested Storehouse -> Company) from SQL DB
                var sectionIdsInProducts = products
                    .Select(p => p.SectionId)
                    .Where(id => id.HasValue)
                    .Select(id => id.Value)
                    .Distinct()
                    .ToList();

                if (sectionIdsInProducts.Any())
                {
                    // Fetch Section entities from SQL DB, including their related Storehouse and Company
                    var sectionsFromDb = await _context.Sections
                                             .Where(sec => sectionIdsInProducts.Contains(sec.SectionId))
                                             .Include(sec => sec.Storehouses)
                                                 .ThenInclude(sh => sh.Companies) // Crucial for company info
                                             .ToListAsync();

                    var sectionDbDict = sectionsFromDb.ToDictionary(sec => sec.SectionId);

                    foreach (var product in products)
                    {
                        if (product.SectionId.HasValue && sectionDbDict.TryGetValue(product.SectionId.Value, out var sectionFromDb))
                        {
                            product.Section = sectionFromDb;
                        }
                    }
                    _logger.LogDebug("Populated Section details (including Storehouse and Company) from SQL DB for the fetched products.");
                }

                _logger.LogInformation("GetAllProductsAsync completed. Returning {ProductCount} product(s).", products.Count);
                return products;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred in ProductService.GetAllProductsAsync. Requested CompanyId: {CompanyId}", companyId.HasValue ? companyId.Value.ToString() : "N/A");
                throw; // Re-throw the exception to be handled by the controller or global error handler
            }
        }

        public async Task<List<Product>> GetProductsBySectionIdAsync(int sectionId)
        {
            _logger?.LogInformation("Attempting to fetch products for SectionId: {SectionId}", sectionId);
            try
            {
                var filter = Builders<Product>.Filter.Eq(p => p.SectionId, sectionId);
                var products = await _products.Find(filter).ToListAsync();

                _logger?.LogInformation("Found {ProductCount} products in MongoDB for SectionId: {SectionId}", products.Count, sectionId);

                if (!products.Any())
                {
                    return products;
                }

                _logger?.LogDebug("Fetching Section details including Storehouse and Company for SectionId: {SectionId}", sectionId);
                var section = await _context.Sections
                                      .Where(sec => sec.SectionId == sectionId)
                                      .Include(sec => sec.Storehouses)
                                          .ThenInclude(sh => sh.Companies)
                                      .FirstOrDefaultAsync();

                if (section == null)
                {
                    _logger?.LogWarning("Could not find Section details in SQL for SectionId: {SectionId}, although {ProductCount} products reference it.", sectionId, products.Count);
                }
                else
                {
                    _logger?.LogDebug("Successfully fetched Section details for SectionId: {SectionId}", sectionId);
                }

                var supplierIds = products.Select(p => p.SupplierId).Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();
                if (supplierIds.Any())
                {
                    var suppliers = await _suppliers.Find(s => supplierIds.Contains(s.SupplierId)).ToListAsync();
                    var supplierDict = suppliers.ToDictionary(s => s.SupplierId);
                    foreach (var product in products)
                    {
                        if (!string.IsNullOrEmpty(product.SupplierId) && supplierDict.TryGetValue(product.SupplierId, out var supplier))
                        {
                            product.Supplier = supplier;
                        }
                    }
                    _logger?.LogDebug("Fetched {SupplierCount} unique suppliers for products in SectionId: {SectionId}", supplierDict.Count, sectionId);
                }

                var categoryIds = products.Select(p => p.CategoryId).Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();
                if (categoryIds.Any())
                {
                    var categories = await _categories.Find(c => categoryIds.Contains(c.CategoryId)).ToListAsync();
                    var categoryDict = categories.ToDictionary(c => c.CategoryId);
                    foreach (var product in products)
                    {
                        if (!string.IsNullOrEmpty(product.CategoryId) && categoryDict.TryGetValue(product.CategoryId, out var category))
                        {
                            product.Category = category;
                        }
                    }
                    _logger?.LogDebug("Fetched {CategoryCount} unique categories for products in SectionId: {SectionId}", categoryDict.Count, sectionId);
                }

                if (section != null)
                {
                    foreach (var product in products)
                    {
                        if (product.SectionId == sectionId)
                        {
                            product.Section = section;
                        }
                    }
                }

                return products;
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error getting products for SectionId {SectionId}", sectionId);
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
