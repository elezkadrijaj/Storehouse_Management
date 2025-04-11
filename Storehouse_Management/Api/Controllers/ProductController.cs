using Application.DTOs;
using Application.Services.Products;
using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProductController : ControllerBase
    {
        private readonly ProductService _productService;
        private readonly ILogger<ProductController> _logger;

        public ProductController(ProductService productService, ILogger<ProductController> logger)
        {
            _productService = productService;
            _logger = logger;

        }

        [HttpGet, Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<ActionResult<List<Product>>> GetAllProducts()
        {
            var products = await _productService.GetAllProductsAsync();
            return products;
        }

        [HttpGet("{id}"), Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<ActionResult<Product>> GetProductById(string id)
        {
            var product = await _productService.GetProductByIdAsync(id);
            if (product == null)
            {
                return NotFound();
            }
            return product;
        }

        [HttpPost, Authorize(Policy = "StorehouseWorkerPolicy")]
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

        [HttpPut("{id}"), Authorize(Policy = "StorehouseWorkerPolicy")]
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

        [HttpDelete("{id}"), Authorize(Policy = "StorehouseWorkerPolicy")]
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
