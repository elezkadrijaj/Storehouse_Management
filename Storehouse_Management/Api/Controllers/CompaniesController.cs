using System.Security.Claims;
using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "CompanyManager")] // Ensure only CompanyManagers can access this
    public class CompaniesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor; // Inject HttpContextAccessor
        private readonly ILogger<CompaniesController> _logger;

        public CompaniesController(AppDbContext context, IHttpContextAccessor httpContextAccessor , ILogger<CompaniesController> logger)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
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

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCompany(int id, Company company)
        {
            if (id != company.CompanyId)
            {
                return BadRequest();
            }

            _context.Entry(company).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!CompanyExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
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
