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
        [Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<ActionResult<List<Product>>> GetAllProducts()
        {
            var companiesIdClaim = _httpContextAccessor.HttpContext?.User.FindFirstValue("CompaniesId");

            if (string.IsNullOrEmpty(companiesIdClaim))
            {
                _logger.LogWarning("CompaniesId claim not found in user token.");
                return Unauthorized("CompaniesId claim not found in the user token.");
            }

            if (!int.TryParse(companiesIdClaim, out int companyId))
            {
                _logger.LogError("Invalid CompaniesId claim format in token: {ClaimValue}", companiesIdClaim);
                return BadRequest("Invalid CompaniesId claim format in token. Must be an integer.");
            }
            var companyExists = await _context.Companies.AnyAsync(c => c.CompanyId == companyId);
            if (!companyExists)
            {
                _logger.LogWarning("Company specified in token claim not found in database. CompanyId: {CompanyId}", companyId);
                return NotFound($"Company specified in token (ID: {companyId}) not found.");
            }

            var products = await _productService.GetAllProductsAsync(companyId); 

            if (products == null)
            {
                _logger.LogError("Product service returned null for companyId {CompanyId}", companyId);
                return StatusCode(StatusCodes.Status500InternalServerError, "Failed to retrieve products.");
            }

            return Ok(products);
        }

        [HttpGet("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
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
        [Authorize(Policy = "StorehouseAccessPolicy")]
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
           
        [HttpGet("search")]
        [ProducesResponseType(typeof(PagedResult<ProductSearchResultDto>), 200)]
        public async Task<IActionResult> SearchProducts([FromQuery] ProductSearchParameters parameters)
        {
            if (parameters.PageNumber < 1) parameters.PageNumber = 1;
            if (parameters.PageSize < 1) parameters.PageSize = 10;
            if (parameters.PageSize > 100) parameters.PageSize = 100;

            var result = await _productSearchService.SearchProductsAsync(parameters);
            return Ok(result);
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
