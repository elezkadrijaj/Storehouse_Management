using Application.DTOs;
using Application.Interfaces;
using Application.Services.Products;
using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;
using System.Security.Claims;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProductController : ControllerBase
    {
        private readonly IAppDbContext _context;
        private readonly ProductService _productService;
        private readonly ILogger<ProductController> _logger;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IProductSearchService _productSearchService;

        public ProductController(IAppDbContext context, ProductService productService, ILogger<ProductController> logger, IHttpContextAccessor httpContextAccessor, IProductSearchService productSearchService)
        {
            _context = context;
            _productService = productService;
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;
            _productSearchService = productSearchService;
        }

        [HttpGet]
        [Authorize(Policy = "WorkerAccessPolicy")]
        public async Task<ActionResult<List<Product>>> GetAllProducts()
        {
            var companiesIdClaim = _httpContextAccessor.HttpContext?.User.FindFirstValue("CompaniesId");
            int? companyIdFromUserRecord = null;
            if (string.IsNullOrEmpty(companiesIdClaim))
            {
                _logger.LogInformation("CompaniesId claim not found in token. Attempting to get from user record.");
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!string.IsNullOrEmpty(userId))
                {
                    var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
                    if (user != null && user.CompaniesId.HasValue)
                    {
                        companyIdFromUserRecord = user.CompaniesId.Value;
                        _logger.LogInformation("Successfully retrieved CompaniesId {CompanyId} from user record for UserId {UserId}", companyIdFromUserRecord, userId);
                    }
                    else
                    {
                        _logger.LogWarning("Could not retrieve CompaniesId from user record. UserID: {UserId}, User found: {UserFound}, User has CompaniesId: {HasCompaniesId}",
                           userId, user != null, user?.CompaniesId.HasValue);
                    }
                }
            }

            int companyIdToFilter;

            if (!string.IsNullOrEmpty(companiesIdClaim) && int.TryParse(companiesIdClaim, out int parsedCompanyIdClaim))
            {
                companyIdToFilter = parsedCompanyIdClaim;
                _logger.LogInformation("Using CompaniesId {CompanyId} from token claim.", companyIdToFilter);
            }
            else if (companyIdFromUserRecord.HasValue)
            {
                companyIdToFilter = companyIdFromUserRecord.Value;
                _logger.LogInformation("Using CompaniesId {CompanyId} from user database record.", companyIdToFilter);
            }
            else
            {
                _logger.LogWarning("CompaniesId could not be determined either from token claim or user record. User cannot view company-specific products.");
                return Unauthorized("User's company could not be determined. Access to products denied.");
            }

            var companyExists = await _context.Companies.AnyAsync(c => c.CompanyId == companyIdToFilter);
            if (!companyExists)
            {
                _logger.LogWarning("Company with determined ID {CompanyId} not found in database.", companyIdToFilter);
                return NotFound($"Company with ID {companyIdToFilter} not found.");
            }

            var products = await _productService.GetAllProductsAsync(companyIdToFilter);

            if (products == null)
            {
                _logger.LogError("Product service returned null for companyId {CompanyId}", companyIdToFilter);
                return StatusCode(StatusCodes.Status500InternalServerError, "Failed to retrieve products.");
            }

            return Ok(products);
        }

        [HttpGet("{id}"), Authorize(Policy = "WorkerAccessPolicy")]
        public async Task<ActionResult<Product>> GetProductById(string id)
        {
            var product = await _productService.GetProductByIdAsync(id);
            if (product == null)
            {
                return NotFound();
            }
            return product;
        }

        [HttpGet("section/{sectionId}")]
        [Authorize(Policy = "WorkerAccessPolicy")]
        public async Task<ActionResult<List<Product>>> GetProductsBySection(int sectionId)
        {
            _logger.LogInformation("API endpoint called to get products for SectionId: {SectionId}", sectionId);

            var sectionExists = await _context.Sections.AnyAsync(s => s.SectionId == sectionId);
            if (!sectionExists)
            {
                _logger.LogWarning("Section with ID: {SectionId} not found when trying to get its products.", sectionId);
                return NotFound($"Section with ID {sectionId} not found.");
            }

            try
            {
                var products = await _productService.GetProductsBySectionIdAsync(sectionId);

                _logger.LogInformation("Successfully retrieved {ProductCount} products for SectionId: {SectionId}", products.Count, sectionId);
                return Ok(products);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred in API endpoint while fetching products for SectionId: {SectionId}", sectionId);
                return StatusCode(StatusCodes.Status500InternalServerError, "An internal server error occurred while retrieving products.");
            }
        }

        [HttpGet("search"), Authorize(Policy = "WorkerAccessPolicy")]
        public async Task<IActionResult> SearchProducts([FromQuery] ProductSearchParameters parameters)
        {
            _logger.LogInformation("Controller: SearchProducts called with parameters: {@Parameters}", parameters);

            if (parameters.PageNumber < 1) parameters.PageNumber = 1;
            if (parameters.PageSize < 1) parameters.PageSize = 10;
            if (parameters.PageSize > 100) parameters.PageSize = 100;

            var companiesIdClaim = _httpContextAccessor.HttpContext?.User.FindFirstValue("CompaniesId");
            int? companyIdFromUserRecord = null;
            string currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            string userRole = User.FindFirstValue(ClaimTypes.Role);
            bool canSearchAllCompanies = userRole == "SuperAdmin";

            if (canSearchAllCompanies)
            {
                _logger.LogInformation("SearchProducts: User role '{UserRole}' allows searching across all companies.", userRole);
                parameters.CompanyId = null;
            }
            else
            {
                if (string.IsNullOrEmpty(companiesIdClaim))
                {
                    _logger.LogInformation("SearchProducts: CompaniesId claim not found in token for UserId {UserId}. Attempting to get from user record.", currentUserId);
                    if (!string.IsNullOrEmpty(currentUserId))
                    {
                        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == currentUserId);
                        if (user != null && user.CompaniesId.HasValue)
                        {
                            companyIdFromUserRecord = user.CompaniesId.Value;
                            _logger.LogInformation("SearchProducts: Successfully retrieved CompaniesId {CompanyId} from user record for UserId {UserId}", companyIdFromUserRecord, currentUserId);
                        }
                        else
                        {
                            _logger.LogWarning("SearchProducts: Could not retrieve CompaniesId from user record for UserId {UserId}. User found: {UserFound}, User has CompaniesId: {HasCompaniesId}",
                               currentUserId, user != null, user?.CompaniesId.HasValue);
                        }
                    }
                }

                int? companyIdToFilterForSearch = null;

                if (!string.IsNullOrEmpty(companiesIdClaim) && int.TryParse(companiesIdClaim, out int parsedCompanyIdClaim))
                {
                    companyIdToFilterForSearch = parsedCompanyIdClaim;
                    _logger.LogInformation("SearchProducts: Using CompaniesId {CompanyId} from token claim for search.", companyIdToFilterForSearch);
                }
                else if (companyIdFromUserRecord.HasValue)
                {
                    companyIdToFilterForSearch = companyIdFromUserRecord.Value;
                    _logger.LogInformation("SearchProducts: Using CompaniesId {CompanyId} from user database record for search.", companyIdToFilterForSearch);
                }
                else
                {
                    _logger.LogWarning("SearchProducts: Non-admin user {UserId} - CompaniesId could not be determined. Product search restricted.", currentUserId);
                    return Unauthorized("User's company could not be determined. Product search access denied.");
                }

                // If a company ID was determined, validate it exists
                if (companyIdToFilterForSearch.HasValue) // Should always have a value here if not super admin and not errored out
                {
                    var companyExists = await _context.Companies.AnyAsync(c => c.CompanyId == companyIdToFilterForSearch.Value);
                    if (!companyExists)
                    {
                        _logger.LogWarning("SearchProducts: Company with determined ID {CompanyId} not found in database.", companyIdToFilterForSearch.Value);
                        return NotFound($"Company with ID {companyIdToFilterForSearch.Value} not found for product search.");
                    }
                    parameters.CompanyId = companyIdToFilterForSearch;
                }
            }
            // --- End CompanyId determination ---

            try
            {
                var result = await _productSearchService.SearchProductsAsync(parameters);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred during product search. Parameters: {@Parameters}", parameters);
                return StatusCode(StatusCodes.Status500InternalServerError, "An unexpected error occurred while searching for products.");
            }
        }

        [HttpPost, Authorize(Policy = "StorehouseAccessPolicy")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CreateProduct([FromForm] ProductCreateDto productDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var product = new Product
            {
                Name = productDto.Name,
                Stock = productDto.Stock,
                ExpiryDate = productDto.ExpiryDate,
                Price = productDto.Price,
                Photo = null,
                SupplierId = productDto.SupplierId,
                CategoryId = productDto.CategoryId,
                SectionId = productDto.SectionId
            };

            try
            {
                await _productService.CreateProductAsync(product, productDto.PhotoFile);

                _logger.LogInformation("Product created via controller, ID: {ProductId}", product.ProductId);
                return CreatedAtAction(nameof(GetProductById), new { id = product.ProductId }, product);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "Error occurred during product creation (likely photo saving): {ErrorMessage}", ex.Message);
                return StatusCode(StatusCodes.Status500InternalServerError, $"An error occurred while processing the product photo: {ex.Message}");
            }
            catch (MongoWriteException ex)
            {
                _logger.LogError(ex, "Database error occurred while creating product name: {ProductName}", product.Name);
                if (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
                {
                    return Conflict($"A product with similar unique properties already exists. {ex.WriteError.Message}");
                }
                return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while saving the product to the database.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Generic error occurred while creating product name: {ProductName}", product.Name);
                return StatusCode(StatusCodes.Status500InternalServerError, "An unexpected error occurred while creating the product.");
            }
        }

        [HttpPut("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> UpdateProduct(string id, [FromBody] Product updatedProduct)
        {

            var existingProduct = await _productService.GetProductByIdAsync(id);
            if (existingProduct == null)
            {
                return NotFound($"Product with id {id} not found.");
            }

            updatedProduct.ProductId = id;

            await _productService.UpdateProductAsync(id, updatedProduct);

            return NoContent();
        }

        [HttpDelete("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> DeleteProduct(string id)
        {
            var product = await _productService.GetProductByIdAsync(id);
            if (product == null)
            {
                return NotFound($"Product with id {id} not found.");
            }

            await _productService.DeleteProductAsync(id);
            return NoContent();
        }
    }
}
