using Application.Services.Products;
using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CategoriesController : ControllerBase
    {
        private readonly CategoryService _categoryService;

        public CategoriesController(CategoryService categoryService)
        {
            _categoryService = categoryService;
        }

        [HttpGet, Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<ActionResult<List<Category>>> GetCategories()
        {
            var categories = await _categoryService.GetAllCategoriesAsync();
            return Ok(categories);
        }

        [HttpGet("{id}"), Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<ActionResult<Category>> GetCategory(string id)
        {
            var category = await _categoryService.GetCategoryByIdAsync(id);
            if (category == null)
            {
                return NotFound();
            }
            return Ok(category);
        }

        [HttpPost, Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<ActionResult<Category>> CreateCategory(Category category)
        {
            await _categoryService.CreateCategoryAsync(category);
            return CreatedAtAction(nameof(GetCategory), new { id = category.CategoryId }, category);
        }

        [HttpPut("{id}"), Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<IActionResult> UpdateCategory(string id, Category category)
        {
            if (id != category.CategoryId)
            {
                return BadRequest(); // Or return a 400 error
            }

            await _categoryService.UpdateCategoryAsync(id, category);
            return NoContent();
        }

        [HttpDelete("{id}"), Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<IActionResult> DeleteCategory(string id)
        {
            await _categoryService.DeleteCategoryAsync(id);
            return NoContent();
        }
    }
}
