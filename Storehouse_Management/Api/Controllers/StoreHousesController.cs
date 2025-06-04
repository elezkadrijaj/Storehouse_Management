using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.Extensions.Logging;
using Application.DTOs;
using Application.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class StorehousesController : ControllerBase
    {
        
        private readonly AppDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IStorehouseRepository _storehouseRepository;
        private readonly ILogger<StorehousesController> _logger;

        public StorehousesController(
            UserManager<ApplicationUser> userManager,
            AppDbContext context,
            IHttpContextAccessor httpContextAccessor,
            ILogger<StorehousesController> logger,
            IStorehouseRepository storehouseRepository)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _userManager = userManager;
            _logger = logger;
            _storehouseRepository = storehouseRepository;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Storehouse>>> GetStorehouses()
        {
            return await _context.Storehouses.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Storehouse>> GetStorehouse(int id)
        {
            var storehouse = await _context.Storehouses.FindAsync(id);

            if (storehouse == null)
            {
                return NotFound();
            }

            return storehouse;
        }

        [HttpPost, Authorize(Policy = "CompanyManagerPolicy")]
        [HttpPost]
         public async Task<ActionResult<Storehouse>> CreateStorehouse([FromBody] Storehouse storehouse)
    {
        var companiesIdClaim = _httpContextAccessor.HttpContext?.User.FindFirstValue("CompaniesId");

        if (string.IsNullOrEmpty(companiesIdClaim))
        {
            _logger.LogWarning("CreateStorehouse: CompaniesId claim not found in the user token for User {UserId}.",
                _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "Unknown");

            return BadRequest("CompaniesId claim not found in the user token. Unable to associate storehouse.");
        }

        if (!int.TryParse(companiesIdClaim, out int companyId))
        {
            _logger.LogError("CreateStorehouse: Invalid CompaniesId claim format '{ClaimValue}' for User {UserId}.",
                companiesIdClaim,
                _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "Unknown");
            return BadRequest("Invalid CompaniesId claim format in token. Must be an integer.");
        }

        storehouse.CompaniesId = companyId;

        var companyExists = await _context.Companies.AnyAsync(c => c.CompanyId == storehouse.CompaniesId);
        if (!companyExists)
        {
            _logger.LogError("CreateStorehouse: Company with ID {CompanyId} derived from token claim not found in database for User {UserId}.",
                storehouse.CompaniesId,
                _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "Unknown");
            return BadRequest($"Company associated with your account (ID: {storehouse.CompaniesId}) not found.");
        }
        storehouse.Companies = null;

        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

       
        _context.Storehouses.Add(storehouse);
        try
        {
            await _context.SaveChangesAsync();
            _logger.LogInformation("CreateStorehouse: Successfully created Storehouse {StorehouseId} for Company {CompanyId} by User {UserId}.",
                storehouse.StorehouseId,
                storehouse.CompaniesId,
                _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "Unknown");
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "CreateStorehouse: Database error occurred while saving Storehouse for Company {CompanyId} by User {UserId}.",
                 storehouse.CompaniesId,
                 _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "Unknown");
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while saving the storehouse.");
        }

        var createdStorehouse = await _context.Storehouses
            .Include(s => s.Companies)
            .FirstOrDefaultAsync(s => s.StorehouseId == storehouse.StorehouseId);

        if (createdStorehouse == null)
        {
             _logger.LogError("CreateStorehouse: Failed to retrieve the newly created Storehouse (ID: {StorehouseId}) after saving for Company {CompanyId}.",
                 storehouse.StorehouseId, storehouse.CompaniesId);
             return StatusCode(StatusCodes.Status500InternalServerError, "Failed to retrieve created storehouse data after saving.");
        }

        return CreatedAtAction(nameof(GetStorehouse), new { id = createdStorehouse.StorehouseId }, createdStorehouse);
    }
        [HttpPut("{id}"), Authorize(Policy = "CompanyManagerPolicy")] 
        public async Task<IActionResult> UpdateStorehouse(int id, [FromBody] UpdateStorehouseDto storehouseDto)
        {
           
            var existingStorehouse = await _context.Storehouses.FindAsync(id);

            if (existingStorehouse == null)
            {
                return NotFound($"Storehouse with ID {id} not found.");
            }

            existingStorehouse.StorehouseName = storehouseDto.StorehouseName;
            existingStorehouse.Location = storehouseDto.Location;
            existingStorehouse.Size_m2 = storehouseDto.Size_m2;

            _context.Entry(existingStorehouse).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {

                if (!StorehouseExists(id))
                {
                    return NotFound($"Storehouse with ID {id} was deleted after you retrieved it.");
                }
                else
                {

                    throw;
                }
            }
            catch (DbUpdateException ex)
            {

                return BadRequest("Error saving changes to the database.");
            }

            return NoContent();
        }

        private bool StorehouseExists(int id)
        {
            return _context.Storehouses.Any(e => e.StorehouseId == id);
        }

    // Add other actions (GET, POST, DELETE) using DTOs as well...


        [HttpDelete("{id}") ,Authorize(Policy = "CompanyManagerPolicy")]
        public async Task<IActionResult> DeleteStorehouse(int id)
        {

            var storehouse = await _context.Storehouses.FindAsync(id);
            if (storehouse == null)
            {
                return NotFound();
            }



            _context.Storehouses.Remove(storehouse);
            await _context.SaveChangesAsync();

            return NoContent();
        }


        [HttpGet("{id}/Sections")]
        public async Task<ActionResult<IEnumerable<Section>>> GetSectionsForStorehouse(int id)
        {
            var storehouse = await _context.Storehouses.FindAsync(id);

            if (storehouse == null)
            {
                return NotFound("Storehouse not found.");
            }

            var sections = await _context.Sections
                .Where(s => s.StorehousesId == id)
                .ToListAsync();

            return sections;
        }
        [HttpGet("my-storehouse-info")]
        public async Task<ActionResult<StorehouseDto>> GetMyStorehouseInfoFromToken()
        {
            var storehouseNameClaim = User.FindFirstValue("StorehouseName");
            var companyIdClaim = User.FindFirstValue("CompaniesId");

            if (string.IsNullOrEmpty(storehouseNameClaim))
            {
                _logger.LogWarning("GetMyStorehouseInfoFromToken: 'StorehouseName' claim was missing or empty in token.");
                return BadRequest(new { message = "Storehouse name not found in token claims." });
            }

            if (string.IsNullOrEmpty(companyIdClaim) || !int.TryParse(companyIdClaim, out int companyId))
            {
                _logger.LogWarning("GetMyStorehouseInfoFromToken: 'CompaniesId' claim was missing or invalid in token for StorehouseName: {StorehouseName}", storehouseNameClaim);
                return BadRequest(new { message = "Valid Company ID not found or invalid in token claims." });
            }

            _logger.LogInformation("Fetching storehouse info for Name: {StorehouseName}, CompanyId: {CompanyId} based on token claims.", storehouseNameClaim, companyId);

            var storehouse = await _storehouseRepository.GetStorehouseByNameAndCompanyIdAsync(storehouseNameClaim, companyId);

            if (storehouse == null)
            {
                _logger.LogWarning("GetMyStorehouseInfoFromToken: Storehouse '{StorehouseName}' for CompanyId {CompanyId} not found in database.", storehouseNameClaim, companyId);
                return NotFound(new { message = $"Storehouse '{storehouseNameClaim}' not found for your company." });
            }

            var storehouseDto = new StorehouseDto
            {
                StorehouseId = storehouse.StorehouseId,
                Name = storehouse.StorehouseName,
                Address = storehouse.Location,
                CompaniesId = storehouse.CompaniesId
            };

            return Ok(storehouseDto);
        }



        [HttpGet("storehouses/{id}/workers"), Authorize(Policy = "StorehouseAccessPolicy")]

        public async Task<ActionResult<IEnumerable<WorkerDto>>> GetWorkersByStorehouseId(int id)
        {
            if (id <= 0)
            {
                return BadRequest(new { message = "Invalid Storehouse ID provided." });
            }

            try
            {
                var storehouseExists = await _context.Storehouses.AnyAsync(s => s.StorehouseId == id);
                if (!storehouseExists)
                {
                    _logger.LogWarning("Storehouse with ID {StorehouseId} requested for workers but not found.", id);
                    return NotFound(new { message = $"Storehouse with ID {id} not found." });
                }

                var workers = await _context.Users
                    .Include(u => u.Companies) 
                    .Where(u => u.StorehouseId == id)
                    .ToListAsync(); 

                if (!workers.Any())
                {
                    _logger.LogInformation("No workers found for Storehouse ID {StorehouseId}.", id);
                    return Ok(new List<WorkerDto>());
                }

                // --- Map to DTOs and fetch roles ---
                var workerDtos = new List<WorkerDto>();
                foreach (var worker in workers)
                {
                    // Get roles for the current worker
                    var userRoles = await _userManager.GetRolesAsync(worker);

                    // Create the DTO
                    var dto = new WorkerDto
                    {
                        Id = worker.Id,
                        CompaniesId = worker.CompaniesId, 
                        Username = worker.UserName,
                        Email = worker.Email,
                        EmailConfirmed = worker.EmailConfirmed,
                        CompanyName = worker.Companies?.Name,
                        CompanyBusinessNumber = worker.CompanyBusinessNumber,
                        StoreHouseName = worker.StorehouseName, 
                        Role = userRoles.FirstOrDefault()
                        
                    };
                    workerDtos.Add(dto);
                }
                // --- End Mapping ---

                return Ok(workerDtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching workers for Storehouse ID {StorehouseId}", id);
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred while fetching workers." });
            }
        }
    }
}