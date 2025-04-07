using Application.Services.Products;
using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProductController : ControllerBase
    {
        private readonly ProductService _productService;

        public ProductController(ProductService productService)
        {
            _productService = productService;
        }

        [HttpGet, Authorize(Policy = "StorehouseWorkerPolicy, CompanyManagerPolicy")]
        public async Task<ActionResult<List<Product>>> GetAllProducts()
        {
            var products = await _productService.GetAllProductsAsync();
            return products;
        }

        [HttpGet("{id}"), Authorize(Policy = "StorehouseWorkerPolicy, CompanyManagerPolicy")]
        public async Task<ActionResult<Product>> GetProductById(string id)
        {
            var product = await _productService.GetProductByIdAsync(id);
            if (product == null)
            {
                return NotFound();
            }
            return product;
        }

        [HttpPost, Authorize(Policy = "StorehouseWorkerPolicy, CompanyManagerPolicy")]
        public async Task<IActionResult> CreateProduct(Product product)
        {
            await _productService.CreateProductAsync(product);
            return CreatedAtAction(nameof(GetProductById), new { id = product.ProductId }, product);
        }

        [HttpPut("{id}"), Authorize(Policy = "StorehouseWorkerPolicy, CompanyManagerPolicy")]
        public async Task<IActionResult> UpdateProduct(string id, Product updatedProduct)
        {
            var product = await _productService.GetProductByIdAsync(id);
            if (product == null)
            {
                return NotFound();
            }
            updatedProduct.ProductId = product.ProductId;
            await _productService.UpdateProductAsync(id, updatedProduct);
            return NoContent();
        }

        [HttpDelete("{id}"), Authorize(Policy = "StorehouseWorkerPolicy, CompanyManagerPolicy")]
        public async Task<IActionResult> DeleteProduct(string id)
        {
            var product = await _productService.GetProductByIdAsync(id);
            if (product == null)
            {
                return NotFound();
            }
            await _productService.DeleteProductAsync(id);
            return NoContent();
        }
    }
}
