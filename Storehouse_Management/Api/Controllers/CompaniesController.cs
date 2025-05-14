using System.Security.Claims;
using Application.DTOs;
using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "CompanyManager")] 
    public class CompaniesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor; 
        private readonly ILogger<CompaniesController> _logger;
        private readonly UserManager<ApplicationUser> _userManager;

        public CompaniesController(AppDbContext context, IHttpContextAccessor httpContextAccessor, ILogger<CompaniesController> logger, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
            _userManager = userManager;
        }

        [HttpGet("my-company")]
        public async Task<ActionResult<Company>> GetMyCompany()
        {
            try
            {

                var companiesIdClaim = _httpContextAccessor.HttpContext?.User.FindFirstValue("CompaniesId");

                if (string.IsNullOrEmpty(companiesIdClaim))
                {
                    _logger.LogWarning("CompaniesId claim not found in user token.");
                    return BadRequest("CompaniesId claim not found in the user token.");
                }

                if (!int.TryParse(companiesIdClaim, out int companyId))
                {
                    _logger.LogError("Invalid CompaniesId claim format: {ClaimValue}", companiesIdClaim);
                    return BadRequest("Invalid CompaniesId claim format.  Must be an integer.");
                }

                var company = await _context.Companies
                    .FirstOrDefaultAsync(c => c.CompanyId == companyId);

                if (company == null)
                {
                    _logger.LogWarning("Company not found with CompaniesId: {CompanyId}", companyId);
                    return NotFound($"Company not found with ID: {companyId}");
                }

                return company;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while retrieving company data.");
                return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while retrieving company data.");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Company>> GetCompany(int id)
        {
            var company = await _context.Companies.FindAsync(id);

            if (company == null)
            {
                return NotFound();
            }

            return company;
        }

        [HttpPost]
        public async Task<ActionResult<Company>> CreateCompany(Company company)
        {
            _context.Companies.Add(company);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetCompany), new { id = company.CompanyId }, company);
        }

        [HttpPut("{companyId}")]
        [Authorize(Roles = "CompanyManager")]
        public async Task<IActionResult> UpdateCompany(int companyId, [FromBody] UpdateCompanyDto model)
        {
            if (!ModelState.IsValid)
            {
                _logger.LogWarning("UpdateCompany: ModelState is invalid. Errors: {@ModelStateErrors}", ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage));
                return BadRequest(ModelState);
            }

            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserId))
            {
                _logger.LogWarning("UpdateCompany: User.FindFirstValue(ClaimTypes.NameIdentifier) returned null or empty.");
                // This case should ideally be caught by [Authorize] attribute, but good to have a check.
                // Returning UnauthorizedResult() might be more appropriate if the identifier is missing.
                return Unauthorized(new { message = "User identifier not found in token." });
            }

            var user = await _userManager.FindByIdAsync(currentUserId);

            if (user == null)
            {
                _logger.LogWarning("UpdateCompany: User not found with ID: {UserId}", currentUserId);
            }

            var company = await _context.Companies.FindAsync(companyId);
            if (company == null)
            {
                _logger.LogWarning("UpdateCompany: Company not found with ID: {CompanyId}", companyId);
                return NotFound(new { message = "Company not found." });
            }

            // Update properties
            company.Name = model.Name;
            company.Phone_Number = model.Phone_Number;
            company.Email = model.Email;
            company.Address = model.Address;
            company.Industry = model.Industry;
            company.UpdatedAt = DateTime.UtcNow;

            try
            {
                _context.Companies.Update(company);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Company profile updated successfully for CompanyId: {CompanyId} by UserId: {UserId}", companyId, currentUserId);
                return Ok(new { message = "Company profile updated successfully.", company = company });
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "UpdateCompany: DbUpdateConcurrencyException for CompanyId: {CompanyId}", companyId);
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Failed to update company due to a concurrency issue. Please try again." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UpdateCompany: An error occurred while updating the company profile for CompanyId: {CompanyId}", companyId);
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred while updating the company profile.", error = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCompany(int id)
        {
            var company = await _context.Companies.FindAsync(id);
            if (company == null)
            {
                return NotFound();
            }


            var storehouses = await _context.Storehouses
                .Where(s => s.CompaniesId == id)
                .ToListAsync();

            _context.Storehouses.RemoveRange(storehouses);
            await _context.SaveChangesAsync();

            _context.Companies.Remove(company);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool CompanyExists(int id)
        {
            return _context.Companies.Any(e => e.CompanyId == id);
        }
        [HttpGet("my-storehouses")]
        public async Task<ActionResult<IEnumerable<Storehouse>>> GetMyStorehouses()
        {
            try
            {

                var companiesIdClaim = _httpContextAccessor.HttpContext?.User.FindFirstValue("CompaniesId");

                if (string.IsNullOrEmpty(companiesIdClaim))
                {
                    _logger.LogWarning("CompaniesId claim not found in user token.");
                    return BadRequest("CompaniesId claim not found in the user token.");
                }

                if (!int.TryParse(companiesIdClaim, out int companyId))
                {
                    _logger.LogError("Invalid CompaniesId claim format: {ClaimValue}", companiesIdClaim);
                    return BadRequest("Invalid CompaniesId claim format. Must be an integer.");
                }

                var storehouses = await _context.Storehouses
                    .Where(s => s.CompaniesId == companyId)
                    .Include(s => s.Companies)
                    .ToListAsync();

                return Ok(storehouses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while retrieving storehouses.");
                return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while retrieving storehouses.");
            }
        }
    }
}
