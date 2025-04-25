using Application.DTOs;
using Application.Interfaces;
using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Application.Services.Products
{
    public class ProductSearchService : IProductSearchService
    {
        private readonly IMongoDbSettings _mongoDatabase;
        private readonly IMongoCollection<Product> _productsCollection;
        private readonly IMongoCollection<Supplier> _suppliersCollection;
        private readonly IMongoCollection<Category> _categoriesCollection;
        private readonly IAppDbContext _context;
        private readonly ILogger<ProductSearchService> _logger;

        public ProductSearchService(IMongoDbSettings mongoDatabase, IAppDbContext sqlDbContext, IMongoClient mongoClient, ILogger<ProductSearchService> logger)
        {
            _mongoDatabase = mongoDatabase;
            _logger = logger;
            _logger.LogWarning("ProductSearchService resolving settings: ConnectionString='{ConnStr}', DatabaseName='{DbName}'", mongoDatabase.ConnectionString, mongoDatabase.DatabaseName);
            var database = mongoClient.GetDatabase(_mongoDatabase.DatabaseName);
            _productsCollection = database.GetCollection<Product>("Products");
            _suppliersCollection = database.GetCollection<Supplier>("Suppliers");
            _categoriesCollection = database.GetCollection<Category>("Categories");
            _context = sqlDbContext;
        }

        public async Task<PagedResult<ProductSearchResultDto>> SearchProductsAsync(ProductSearchParameters parameters)
        {
            var filterBuilder = Builders<Product>.Filter;
            var filters = new List<FilterDefinition<Product>> { filterBuilder.Empty };

            List<string>? supplierIds = null;
            if (!string.IsNullOrWhiteSpace(parameters.SupplierName))
            {
                var supplierNameFilter = Builders<Supplier>.Filter.Regex(s => s.Name, new BsonRegularExpression(parameters.SupplierName, "i"));
                supplierIds = await _suppliersCollection.Find(supplierNameFilter)
                                                       .Project(s => s.SupplierId)
                                                       .ToListAsync();
                if (supplierIds == null || !supplierIds.Any()) return new PagedResult<ProductSearchResultDto>(new List<ProductSearchResultDto>(), 0, parameters.PageNumber, parameters.PageSize);
                filters.Add(filterBuilder.In(p => p.SupplierId, supplierIds));
            }

            List<string>? categoryIds = null;
            if (!string.IsNullOrWhiteSpace(parameters.CategoryName))
            {
                var categoryNameFilter = Builders<Category>.Filter.Regex(c => c.Name, new BsonRegularExpression(parameters.CategoryName, "i"));
                categoryIds = await _categoriesCollection.Find(categoryNameFilter)
                                                        .Project(c => c.CategoryId)
                                                        .ToListAsync();
                if (categoryIds == null || !categoryIds.Any()) return new PagedResult<ProductSearchResultDto>(new List<ProductSearchResultDto>(), 0, parameters.PageNumber, parameters.PageSize);
                filters.Add(filterBuilder.In(p => p.CategoryId, categoryIds));
            }

            List<int>? sectionIds = null;
            if (!string.IsNullOrWhiteSpace(parameters.SectionName) || !string.IsNullOrWhiteSpace(parameters.StorehouseName) || !string.IsNullOrWhiteSpace(parameters.StorehouseLocation))
            {
                var sectionQuery = _context.Sections.AsQueryable();

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

                sectionIds = await sectionQuery.Select(s => s.SectionId).Distinct().ToListAsync();

                if (sectionIds == null || !sectionIds.Any()) return new PagedResult<ProductSearchResultDto>(new List<ProductSearchResultDto>(), 0, parameters.PageNumber, parameters.PageSize);

                filters.Add(filterBuilder.In("SectionId", sectionIds));
            }

            if (!string.IsNullOrWhiteSpace(parameters.FullTextTerm))
            {
                filters.Add(filterBuilder.Text(parameters.FullTextTerm, new TextSearchOptions { CaseSensitive = false }));
            }
            if (parameters.MinPrice.HasValue)
            {
                filters.Add(filterBuilder.Gte(p => p.Price, parameters.MinPrice.Value));
            }
            if (parameters.MaxPrice.HasValue)
            {
                filters.Add(filterBuilder.Lte(p => p.Price, parameters.MaxPrice.Value));
            }
            if (parameters.MinStock.HasValue)
            {
                filters.Add(filterBuilder.Gte(p => p.Stock, parameters.MinStock.Value));
            }
            if (parameters.MinExpiryDate.HasValue)
            {
                filters.Add(filterBuilder.Gte(p => p.ExpiryDate, parameters.MinExpiryDate.Value));
            }
            if (parameters.MaxExpiryDate.HasValue)
            {
                filters.Add(filterBuilder.Lte(p => p.ExpiryDate, parameters.MaxExpiryDate.Value));
            }

            var finalFilter = filterBuilder.And(filters);

            var sortBuilder = Builders<Product>.Sort;
            SortDefinition<Product> sortDefinition = sortBuilder.Ascending(p => p.Name);

            if (!string.IsNullOrWhiteSpace(parameters.SortBy))
            {
                bool descending = parameters.SortDirection?.ToUpperInvariant() == "DESC";
                switch (parameters.SortBy.ToLowerInvariant())
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
            }

            var findFluent = _productsCollection.Find(finalFilter);
            long totalCount = await findFluent.CountDocumentsAsync();
            var products = await findFluent
                .Sort(sortDefinition)
                .Skip((parameters.PageNumber - 1) * parameters.PageSize)
                .Limit(parameters.PageSize)
                .ToListAsync();

            var resultingProductIds = products.Select(p => p.ProductId).ToList();
            var resultingSupplierIds = products.Where(p => !string.IsNullOrEmpty(p.SupplierId)).Select(p => p.SupplierId).Distinct().ToList();
            var resultingCategoryIds = products.Where(p => !string.IsNullOrEmpty(p.CategoryId)).Select(p => p.CategoryId).Distinct().ToList();
            var resultingSectionIds = products.Where(p => p.SectionId.HasValue).Select(p => p.SectionId.Value).Distinct().ToList();

            var supplierDetailsFilter = Builders<Supplier>.Filter.In(s => s.SupplierId, resultingSupplierIds);
            var suppliers = resultingSupplierIds.Any()
                 ? await _suppliersCollection.Find(supplierDetailsFilter).ToListAsync()
                 : new List<Supplier>();
            var supplierDict = suppliers.ToDictionary(s => s.SupplierId);

            var categoryDetailsFilter = Builders<Category>.Filter.In(c => c.CategoryId, resultingCategoryIds);
            var categories = resultingCategoryIds.Any()
                ? await _categoriesCollection.Find(categoryDetailsFilter).ToListAsync()
                : new List<Category>();
            var categoryDict = categories.ToDictionary(c => c.CategoryId);

            var sections = resultingSectionIds.Any()
                 ? await _context.Sections
                                      .Include(sec => sec.Storehouses)
                                      .Where(sec => resultingSectionIds.Contains(sec.SectionId))
                                      .ToListAsync()
                 : new List<Section>();
            var sectionDict = sections.ToDictionary(sec => sec.SectionId);

            var resultsDto = products.Select(p =>
            {
                supplierDict.TryGetValue(p.SupplierId ?? "", out var supplier);
                categoryDict.TryGetValue(p.CategoryId ?? "", out var category);
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
                    StorehouseLocation = section?.Storehouses?.Location
                };
            }).ToList();

            return new PagedResult<ProductSearchResultDto>(resultsDto, (int)totalCount, parameters.PageNumber, parameters.PageSize);
        }
    }
}
