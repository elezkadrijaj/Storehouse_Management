// Api.Controllers.SuppliersController.cs
using Application.Interfaces;
using Application.Services.Products; // Your SupplierService
using Core.Entities;
using Infrastructure.Data; // For IAppDbContext
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore; // For EF Core operations
using Microsoft.Extensions.Logging; // Added for logging
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SuppliersController : ControllerBase
    {
        private readonly SupplierService _supplierService;
        private readonly ILogger<SuppliersController> _logger;
        private readonly IAppDbContext _context; // To get CompanyId from User record

        public SuppliersController(
            SupplierService supplierService,
            ILogger<SuppliersController> logger,
            IAppDbContext context) // Inject dependencies
        {
            _supplierService = supplierService;
            _logger = logger;
            _context = context;
        }

        // Helper method to get CompanyId (same as in CategoriesController)
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
        public async Task<ActionResult<List<Supplier>>> GetSuppliers()
        {
            var (companyIdValue, errorResult) = await GetCurrentUserCompanyIdAsync();
            if (errorResult != null)
            {
                _logger.LogWarning("Error retrieving CompanyId: {ErrorMessage}", errorResult);
                return BadRequest(new { message = "Unable to retrieve CompanyId." });
            }
            int companyId = companyIdValue.Value;

            _logger.LogInformation("Controller: GetSuppliers called for CompanyId: {CompanyId}", companyId);
            var suppliers = await _supplierService.GetAllSuppliersAsync(companyId);
            return Ok(suppliers);
        }

        [HttpGet("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<ActionResult<Supplier>> GetSupplier(string id)
        {
            var (companyIdValue, errorResult) = await GetCurrentUserCompanyIdAsync();
            if (errorResult != null)
            {
                _logger.LogWarning("Error retrieving CompanyId: {ErrorMessage}", errorResult);
                return BadRequest(new { message = "Unable to retrieve CompanyId." });
            }
            int companyId = companyIdValue.Value;

            _logger.LogInformation("Controller: GetSupplier called for Id: {SupplierId}, CompanyId: {CompanyId}", id, companyId);
            var supplier = await _supplierService.GetSupplierByIdAsync(id, companyId);
            if (supplier == null)
            {
                _logger.LogWarning("Supplier with Id {SupplierId} not found for CompanyId {CompanyId}", id, companyId);
                return NotFound(new { message = $"Supplier with ID {id} not found for your company." });
            }
            return Ok(supplier);
        }

        // DTO for supplier creation
        public class SupplierCreateDto
        {
            // Add validation attributes (e.g., [Required], [StringLength])
            public string Name { get; set; } = string.Empty;
            public string ContactInfo { get; set; } = string.Empty;
        }

        [HttpPost, Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<ActionResult<Supplier>> CreateSupplier([FromBody] SupplierCreateDto supplierDto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var (companyIdValue, errorResult) = await GetCurrentUserCompanyIdAsync();
            if (errorResult != null)
            {
                _logger.LogWarning("Error retrieving CompanyId: {ErrorMessage}", errorResult);
                return BadRequest(new { message = "Unable to retrieve CompanyId." });
            }
            int companyId = companyIdValue.Value;

            _logger.LogInformation("Controller: CreateSupplier called for Name: {SupplierName}, CompanyId: {CompanyId}", supplierDto.Name, companyId);
            var supplier = new Supplier
            {
                Name = supplierDto.Name,
                ContactInfo = supplierDto.ContactInfo,
                CompanyId = companyId // Set CompanyId from authenticated user
            };

            try
            {
                await _supplierService.CreateSupplierAsync(supplier);
                return CreatedAtAction(nameof(GetSupplier), new { id = supplier.SupplierId }, supplier);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Failed to create supplier due to business rule violation (e.g. duplicate name for company).");
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unexpected error occurred while creating supplier.");
                return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while creating the supplier.");
            }
        }

        // DTO for supplier update
        public class SupplierUpdateDto
        {
            public string Name { get; set; } = string.Empty;
            public string ContactInfo { get; set; } = string.Empty;
        }

        [HttpPut("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> UpdateSupplier(string id, [FromBody] SupplierUpdateDto supplierUpdateDto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var (companyIdValue, errorResult) = await GetCurrentUserCompanyIdAsync();
            if (errorResult != null) return errorResult;
            int companyId = companyIdValue.Value;

            _logger.LogInformation("Controller: UpdateSupplier called for Id: {SupplierId}, CompanyId: {CompanyId}", id, companyId);
            var supplierToUpdate = new Supplier
            {
                SupplierId = id, // From path
                Name = supplierUpdateDto.Name,
                ContactInfo = supplierUpdateDto.ContactInfo,
                CompanyId = companyId // From authenticated user
            };

            try
            {
                bool success = await _supplierService.UpdateSupplierAsync(id, companyId, supplierToUpdate);
                if (!success)
                {
                    _logger.LogWarning("Supplier with Id {SupplierId} not found for update or not modified for CompanyId {CompanyId}", id, companyId);
                    return NotFound(new { message = $"Supplier with ID {id} not found for your company, or no changes were made." });
                }
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Failed to update supplier due to business rule violation (e.g. duplicate name for company).");
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An unexpected error occurred while updating supplier Id {SupplierId}.", id);
                return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while updating the supplier.");
            }
        }

        [HttpDelete("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> DeleteSupplier(string id)
        {
            var (companyIdValue, errorResult) = await GetCurrentUserCompanyIdAsync();
            if (errorResult != null) return errorResult;
            int companyId = companyIdValue.Value;

            _logger.LogInformation("Controller: DeleteSupplier called for Id: {SupplierId}, CompanyId: {CompanyId}", id, companyId);
            bool success = await _supplierService.DeleteSupplierAsync(id, companyId);
            if (!success)
            {
                _logger.LogWarning("Supplier with Id {SupplierId} could not be deleted for CompanyId {CompanyId}.", id, companyId);
                return NotFound(new { message = $"Supplier with ID {id} not found for your company or could not be deleted." });
            }
            return NoContent();
        }
    }
}