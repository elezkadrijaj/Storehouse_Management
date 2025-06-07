// Application.Services.Products.ProductSearchService.cs
using Application.DTOs;
using Application.Interfaces;
using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Bson.Serialization; // For BsonSerializer if needed for other things
using MongoDB.Driver;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks; // For Task

namespace Application.Services.Products
{
    public class ProductSearchService : IProductSearchService
    {
        private readonly IMongoDbSettings _mongoDatabaseSettings;
        private readonly IMongoCollection<Product> _productsCollection;
        private readonly IMongoCollection<Supplier> _suppliersCollection;
        private readonly IMongoCollection<Category> _categoriesCollection;
        private readonly IAppDbContext _sqlDbContext;
        private readonly ILogger<ProductSearchService> _logger;

        public ProductSearchService(
            IMongoDbSettings mongoDatabaseSettings,
            IAppDbContext sqlDbContext,
            IMongoClient mongoClient,
            ILogger<ProductSearchService> logger)
        {
            _mongoDatabaseSettings = mongoDatabaseSettings;
            _sqlDbContext = sqlDbContext;
            _logger = logger;

            _logger.LogInformation("ProductSearchService initializing. Attempting to connect to MongoDB: DatabaseName='{DbName}'", _mongoDatabaseSettings.DatabaseName);
            var database = mongoClient.GetDatabase(_mongoDatabaseSettings.DatabaseName);
            _productsCollection = database.GetCollection<Product>("Products");
            _suppliersCollection = database.GetCollection<Supplier>("Suppliers");
            _categoriesCollection = database.GetCollection<Category>("Categories");
            _logger.LogInformation("ProductSearchService initialized successfully.");
        }

        public async Task<PagedResult<ProductSearchResultDto>> SearchProductsAsync(ProductSearchParameters parameters)
        {
            _logger.LogInformation("Service: SearchProductsAsync started with parameters: {@Parameters}", parameters);

            var filterBuilder = Builders<Product>.Filter;
            var filters = new List<FilterDefinition<Product>>();

            // --- COMPANY FILTERING (APPLY FIRST IF CompanyId IS PRESENT IN PARAMETERS) ---
            List<int?>? companySpecificSectionIds = null;
            if (parameters.CompanyId.HasValue)
            {
                _logger.LogDebug("Applying CompanyId filter: {CompanyId}. Finding relevant SectionIds from SQL DB.", parameters.CompanyId.Value);
                companySpecificSectionIds = await _sqlDbContext.Sections
                    .Where(s => s.Storehouses != null && s.Storehouses.CompaniesId == parameters.CompanyId.Value)
                    .Select(s => (int?)s.SectionId) // Cast to int? to match Product.SectionId
                    .Distinct()
                    .ToListAsync();

                if (companySpecificSectionIds == null || !companySpecificSectionIds.Any())
                {
                    _logger.LogInformation("No sections found associated with CompanyId: {CompanyId}. Search will yield no results for this company.", parameters.CompanyId.Value);
                    return new PagedResult<ProductSearchResultDto>(new List<ProductSearchResultDto>(), 0, parameters.PageNumber, parameters.PageSize);
                }
                _logger.LogDebug("Found {Count} SectionId(s) for CompanyId {CompanyId}: [{SectionIds}]",
                    companySpecificSectionIds.Count, parameters.CompanyId.Value, string.Join(", ", companySpecificSectionIds.Select(id => id.ToString())));

                filters.Add(filterBuilder.In(nameof(Product.SectionId), companySpecificSectionIds));
            }
            // --- END COMPANY FILTERING ---

            // --- SUPPLIER NAME FILTER ---
            if (!string.IsNullOrWhiteSpace(parameters.SupplierName))
            {
                var supplierNameFilter = Builders<Supplier>.Filter.Regex(s => s.Name, new BsonRegularExpression(parameters.SupplierName, "i")); // Case-insensitive regex
                var supplierIdsFromName = await _suppliersCollection.Find(supplierNameFilter)
                                                               .Project(s => s.SupplierId)
                                                               .ToListAsync();
                if (supplierIdsFromName == null || !supplierIdsFromName.Any())
                {
                    _logger.LogInformation("No suppliers found matching name '{SupplierName}'. Search based on supplier will yield no results.", parameters.SupplierName);
                    return new PagedResult<ProductSearchResultDto>(new List<ProductSearchResultDto>(), 0, parameters.PageNumber, parameters.PageSize);
                }
                filters.Add(filterBuilder.In(p => p.SupplierId, supplierIdsFromName));
                _logger.LogDebug("Added supplier name filter for: {SupplierName}, found IDs: [{SupplierIds}]", parameters.SupplierName, string.Join(", ", supplierIdsFromName));
            }

            // --- CATEGORY NAME FILTER ---
            if (!string.IsNullOrWhiteSpace(parameters.CategoryName))
            {
                var categoryNameFilter = Builders<Category>.Filter.Regex(c => c.Name, new BsonRegularExpression(parameters.CategoryName, "i"));
                var categoryIdsFromName = await _categoriesCollection.Find(categoryNameFilter)
                                                                .Project(c => c.CategoryId)
                                                                .ToListAsync();
                if (categoryIdsFromName == null || !categoryIdsFromName.Any())
                {
                    _logger.LogInformation("No categories found matching name '{CategoryName}'. Search based on category will yield no results.", parameters.CategoryName);
                    return new PagedResult<ProductSearchResultDto>(new List<ProductSearchResultDto>(), 0, parameters.PageNumber, parameters.PageSize);
                }
                filters.Add(filterBuilder.In(p => p.CategoryId, categoryIdsFromName));
                _logger.LogDebug("Added category name filter for: {CategoryName}, found IDs: [{CategoryIds}]", parameters.CategoryName, string.Join(", ", categoryIdsFromName));
            }

            // --- SECTION/STOREHOUSE NAME/LOCATION FILTERS ---
            if (!string.IsNullOrWhiteSpace(parameters.SectionName) || !string.IsNullOrWhiteSpace(parameters.StorehouseName) || !string.IsNullOrWhiteSpace(parameters.StorehouseLocation))
            {
                var sectionQuery = _sqlDbContext.Sections.AsQueryable();

                if (companySpecificSectionIds != null && companySpecificSectionIds.Any())
                {
                    var nonNullableCompanySectionIds = companySpecificSectionIds.Where(id => id.HasValue).Select(id => id.Value).ToList();
                    if (nonNullableCompanySectionIds.Any())
                    {
                        sectionQuery = sectionQuery.Where(s => nonNullableCompanySectionIds.Contains(s.SectionId));
                        _logger.LogDebug("Refining section search within already determined company sections.");
                    }
                }

                if (!string.IsNullOrWhiteSpace(parameters.SectionName))
                {
                    sectionQuery = sectionQuery.Where(s => s.Name.Contains(parameters.SectionName));
                }
                if (!string.IsNullOrWhiteSpace(parameters.StorehouseName))
                {
                    sectionQuery = sectionQuery.Include(s => s.Storehouses)
                                              .Where(s => s.Storehouses != null && s.Storehouses.StorehouseName.Contains(parameters.StorehouseName));
                }
                if (!string.IsNullOrWhiteSpace(parameters.StorehouseLocation))
                {
                    sectionQuery = sectionQuery.Include(s => s.Storehouses)
                                              .Where(s => s.Storehouses != null && s.Storehouses.Location.Contains(parameters.StorehouseLocation));
                }

                var searchSpecificSectionIds = await sectionQuery.Select(s => (int?)s.SectionId).Distinct().ToListAsync();

                if (searchSpecificSectionIds == null || !searchSpecificSectionIds.Any())
                {
                    _logger.LogInformation("No sections matched SectionName/StorehouseName/Location criteria. Search will yield no results based on these specific criteria.");
                    return new PagedResult<ProductSearchResultDto>(new List<ProductSearchResultDto>(), 0, parameters.PageNumber, parameters.PageSize);
                }
                filters.Add(filterBuilder.In(nameof(Product.SectionId), searchSpecificSectionIds));
                _logger.LogDebug("Added Section/Storehouse specific filters, found SectionIDs: [{SectionIds}]", string.Join(", ", searchSpecificSectionIds.Select(id => id.ToString())));
            }

            // --- OTHER PRODUCT PROPERTY FILTERS ---
            if (!string.IsNullOrWhiteSpace(parameters.FullTextTerm))
            {
                filters.Add(filterBuilder.Text(parameters.FullTextTerm, new TextSearchOptions { CaseSensitive = false, Language = "none" }));
                _logger.LogDebug("Added full text search filter for term: {FullTextTerm}", parameters.FullTextTerm);
            }
            if (parameters.MinPrice.HasValue) filters.Add(filterBuilder.Gte(p => p.Price, parameters.MinPrice.Value));
            if (parameters.MaxPrice.HasValue) filters.Add(filterBuilder.Lte(p => p.Price, parameters.MaxPrice.Value));
            if (parameters.MinStock.HasValue) filters.Add(filterBuilder.Gte(p => p.Stock, parameters.MinStock.Value));
            if (parameters.MinExpiryDate.HasValue) filters.Add(filterBuilder.Gte(p => p.ExpiryDate, parameters.MinExpiryDate.Value));
            if (parameters.MaxExpiryDate.HasValue) filters.Add(filterBuilder.Lte(p => p.ExpiryDate, parameters.MaxExpiryDate.Value));

            // --- FINAL FILTER CONSTRUCTION ---
            FilterDefinition<Product> finalFilter = filterBuilder.Empty;
            if (filters.Any())
            {
                finalFilter = filterBuilder.And(filters);
            }

            // --- For debugging the generated MongoDB query ---
            _logger.LogDebug("Constructed MongoDB filter definition: {FilterString}", finalFilter.ToString());

            // --- SORTING ---
            var sortBuilder = Builders<Product>.Sort;
            SortDefinition<Product> sortDefinition = sortBuilder.Ascending(p => p.Name);

            if (!string.IsNullOrWhiteSpace(parameters.SortBy))
            {
                bool descending = parameters.SortDirection?.ToUpperInvariant() == "DESC";
                switch (parameters.SortBy.Trim().ToLowerInvariant())
                {
                    case "price":
                        sortDefinition = descending ? sortBuilder.Descending(p => p.Price) : sortBuilder.Ascending(p => p.Price);
                        break;
                    case "stock":
                        sortDefinition = descending ? sortBuilder.Descending(p => p.Stock) : sortBuilder.Ascending(p => p.Stock);
                        break;
                    case "expirydate":
                        sortDefinition = descending ? sortBuilder.Descending(p => p.ExpiryDate) : sortBuilder.Ascending(p => p.ExpiryDate);
                        break;
                    case "name":
                    default:
                        sortDefinition = descending ? sortBuilder.Descending(p => p.Name) : sortBuilder.Ascending(p => p.Name);
                        break;
                }
                _logger.LogDebug("Applied sorting: {SortBy} {SortDirection}", parameters.SortBy, descending ? "DESC" : "ASC");
            }

            // --- PAGINATION AND EXECUTION ---
            var findFluent = _productsCollection.Find(finalFilter);
            long totalCount = await findFluent.CountDocumentsAsync();

            if (totalCount == 0)
            {
                _logger.LogInformation("Total count of matching documents is 0. Returning empty paged result.");
                return new PagedResult<ProductSearchResultDto>(new List<ProductSearchResultDto>(), 0, parameters.PageNumber, parameters.PageSize);
            }

            var products = await findFluent
                .Sort(sortDefinition)
                .Skip((parameters.PageNumber - 1) * parameters.PageSize)
                .Limit(parameters.PageSize)
                .ToListAsync();

            _logger.LogInformation("Retrieved {ProductCountOnPage} product(s) for page {PageNumber}. Total matching products: {TotalCount}", products.Count, parameters.PageNumber, totalCount);

            // --- POPULATE DTO WITH RELATED DATA ---
            var resultingSupplierIds = products.Where(p => !string.IsNullOrEmpty(p.SupplierId)).Select(p => p.SupplierId).Distinct().ToList();
            var resultingCategoryIds = products.Where(p => !string.IsNullOrEmpty(p.CategoryId)).Select(p => p.CategoryId).Distinct().ToList();
            var resultingSectionIdsFromProducts = products.Where(p => p.SectionId.HasValue).Select(p => p.SectionId.Value).Distinct().ToList();

            var suppliersTask = resultingSupplierIds.Any()
                 ? _suppliersCollection.Find(Builders<Supplier>.Filter.In(s => s.SupplierId, resultingSupplierIds)).ToListAsync()
                 : Task.FromResult(new List<Supplier>());

            var categoriesTask = resultingCategoryIds.Any()
                ? _categoriesCollection.Find(Builders<Category>.Filter.In(c => c.CategoryId, resultingCategoryIds)).ToListAsync()
                : Task.FromResult(new List<Category>());

            var sectionsTask = resultingSectionIdsFromProducts.Any()
                 ? _sqlDbContext.Sections
                              .Include(sec => sec.Storehouses)
                                  .ThenInclude(sh => sh.Companies)
                              .Where(sec => resultingSectionIdsFromProducts.Contains(sec.SectionId))
                              .ToListAsync()
                 : Task.FromResult(new List<Section>());

            await Task.WhenAll(suppliersTask, categoriesTask, sectionsTask);

            var supplierDict = (await suppliersTask).ToDictionary(s => s.SupplierId);
            var categoryDict = (await categoriesTask).ToDictionary(c => c.CategoryId);
            var sectionDict = (await sectionsTask).ToDictionary(sec => sec.SectionId);

            var resultsDto = products.Select(p =>
            {
                supplierDict.TryGetValue(p.SupplierId ?? string.Empty, out var supplier);
                categoryDict.TryGetValue(p.CategoryId ?? string.Empty, out var category);
                sectionDict.TryGetValue(p.SectionId ?? -1, out var section);

                return new ProductSearchResultDto
                {
                    ProductId = p.ProductId,
                    Name = p.Name,
                    Stock = p.Stock,
                    ExpiryDate = p.ExpiryDate,
                    Price = p.Price,
                    Photo = p.Photo,
                    SupplierId = p.SupplierId,
                    SupplierName = supplier?.Name,
                    CategoryId = p.CategoryId,
                    CategoryName = category?.Name,
                    SectionId = p.SectionId,
                    SectionName = section?.Name,
                    StorehouseName = section?.Storehouses?.StorehouseName,
                    StorehouseLocation = section?.Storehouses?.Location,
                    // CompanyName = section?.Storehouses?.Companies?.Name // Optional
                };
            }).ToList();

            _logger.LogInformation("SearchProductsAsync completed. Returning {DtoCount} DTOs.", resultsDto.Count);
            return new PagedResult<ProductSearchResultDto>(resultsDto, (int)totalCount, parameters.PageNumber, parameters.PageSize);
        }
    }
}