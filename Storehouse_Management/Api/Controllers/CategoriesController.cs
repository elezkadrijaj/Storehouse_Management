using Application.Services.Products;
using Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Application.Interfaces;


namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CategoriesController : ControllerBase
    {
        private readonly CategoryService _categoryService;
        private readonly ILogger<CategoriesController> _logger;
        private readonly IAppDbContext _context;

        public CategoriesController(
            CategoryService categoryService,
            ILogger<CategoriesController> logger,
            IAppDbContext context)
        {
            _categoryService = categoryService;
            _logger = logger;
            _context = context;
        }

        private async Task<(int? CompanyId, IActionResult? ErrorResult)> GetCurrentUserCompanyIdAsync()
        {
            var companyIdClaim = User.FindFirstValue("CompaniesId");
            if (!string.IsNullOrEmpty(companyIdClaim) && int.TryParse(companyIdClaim, out int parsedCompanyId))
            {
                return (parsedCompanyId, null);
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning("Controller: User identity (NameIdentifier) not found in token.");
                return (null, Unauthorized(new { message = "User identity not found." }));
            }

            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
            {
                _logger.LogWarning("Controller: User profile not found for UserId: {UserId}", userId);
                return (null, NotFound(new { message = "User profile not found." }));
            }

            if (!user.CompaniesId.HasValue)
            {
                _logger.LogWarning("Controller: User {UserId} is not associated with a company.", userId);
                return (null, BadRequest(new { message = "User is not associated with a company." }));
            }
            return (user.CompaniesId.Value, null);
        }


        [HttpGet, Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<ActionResult<List<Category>>> GetCategories()
        {
            var (companyId, errorResult) = await GetCurrentUserCompanyIdAsync();
            if (errorResult != null)
            {
                _logger.LogWarning("Error retrieving CompanyId: {ErrorMessage}", errorResult);
                return BadRequest(new { message = "Unable to retrieve CompanyId." });
            }

            _logger.LogInformation("Controller: GetCategories called for CompanyId: {CompanyId}", companyId.Value);
            var categories = await _categoryService.GetAllCategoriesAsync(companyId.Value);
            return Ok(categories);
        }

        [HttpGet("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<ActionResult<Category>> GetCategory(string id)
        {
            var (companyId, errorResult) = await GetCurrentUserCompanyIdAsync();
            if (errorResult != null)
            {
                _logger.LogWarning("Error retrieving CompanyId: {ErrorMessage}", errorResult);
                return BadRequest(new { message = "Unable to retrieve CompanyId." });
            }

            _logger.LogInformation("Controller: GetCategory called for Id: {CategoryId}, CompanyId: {CompanyId}", id, companyId.Value);
            var category = await _categoryService.GetCategoryByIdAsync(id, companyId.Value);
            if (category == null)
            {
                _logger.LogWarning("Category with Id {CategoryId} not found for CompanyId {CompanyId}", id, companyId.Value);
                return NotFound(new { message = $"Category with ID {id} not found for your company." });
            }
            return Ok(category);
        }

        [HttpPost, Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<ActionResult<Category>> CreateCategory([FromBody] CategoryCreateDto categoryDto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var (companyId, errorResult) = await GetCurrentUserCompanyIdAsync();
            if (errorResult != null)
            {
                _logger.LogWarning("Error retrieving CompanyId: {ErrorMessage}", errorResult);
                return BadRequest(new { message = "Unable to retrieve CompanyId." });
            }

            _logger.LogInformation("Controller: CreateCategory called for Name: {CategoryName}, CompanyId: {CompanyId}", categoryDto.Name, companyId.Value);

            var category = new Category
            {
                Name = categoryDto.Name,
                CompanyId = companyId.Value
            };

            try
            {
                await _categoryService.CreateCategoryAsync(category);
                return CreatedAtAction(nameof(GetCategory), new { id = category.CategoryId }, category);
            }
            catch (InvalidOperationException ex)
            {
                 _logger.LogWarning(ex, "Failed to create category due to business rule violation (e.g. duplicate name for company).");
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unexpected error occurred while creating category.");
                return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while creating the category.");
            }
        }

        public class CategoryCreateDto
        {
            public string Name { get; set; } = string.Empty;
        }

        public class CategoryUpdateDto
        {
            public string Name { get; set; } = string.Empty;
        }


        [HttpPut("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> UpdateCategory(string id, [FromBody] CategoryUpdateDto categoryUpdateDto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var (companyId, errorResult) = await GetCurrentUserCompanyIdAsync();
            if (errorResult != null) return errorResult;

            _logger.LogInformation("Controller: UpdateCategory called for Id: {CategoryId}, CompanyId: {CompanyId}", id, companyId.Value);

            var categoryToUpdate = new Category
            {
                CategoryId = id,
                Name = categoryUpdateDto.Name,
                CompanyId = companyId.Value
            };

            try
            {
                bool success = await _categoryService.UpdateCategoryAsync(id, companyId.Value, categoryToUpdate);
                if (!success)
                {
                    _logger.LogWarning("Category with Id {CategoryId} not found for update or not modified for CompanyId {CompanyId}", id, companyId.Value);
                    return NotFound(new { message = $"Category with ID {id} not found for your company, or no changes were made." });
                }
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                 _logger.LogWarning(ex, "Failed to update category due to business rule violation (e.g. duplicate name for company).");
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                 _logger.LogError(ex, "An unexpected error occurred while updating category Id {CategoryId}.", id);
                return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while updating the category.");
            }
        }

        [HttpDelete("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> DeleteCategory(string id)
        {
            var (companyId, errorResult) = await GetCurrentUserCompanyIdAsync();
            if (errorResult != null) return errorResult;

            _logger.LogInformation("Controller: DeleteCategory called for Id: {CategoryId}, CompanyId: {CompanyId}", id, companyId.Value);

            bool success = await _categoryService.DeleteCategoryAsync(id, companyId.Value);
            if (!success)
            {
                _logger.LogWarning("Category with Id {CategoryId} could not be deleted for CompanyId {CompanyId} (not found or other reason).", id, companyId.Value);
                return NotFound(new { message = $"Category with ID {id} not found for your company or could not be deleted." });
            }
            return NoContent();
        }
    }
}