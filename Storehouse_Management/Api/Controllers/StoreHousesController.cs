using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.Extensions.Logging;
using Application.Interfaces;
using Application.DTOs;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class StorehousesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IStorehouseRepository _storehouseRepository;
        private readonly ILogger<StorehousesController> _logger;

        public StorehousesController(
            AppDbContext context,
            IHttpContextAccessor httpContextAccessor,
            ILogger<StorehousesController> logger,
            IStorehouseRepository storehouseRepository)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
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

        [HttpPost]
        public async Task<ActionResult<Storehouse>> CreateStorehouse(Storehouse storehouse)
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


            storehouse.CompaniesId = companyId;

            var company = await _context.Companies.FindAsync(storehouse.CompaniesId);
            if (company == null)
            {
                return BadRequest("Company with specified ID not found.");
            }

            storehouse.Companies = null;

            _context.Storehouses.Add(storehouse);
            await _context.SaveChangesAsync();


            var createdStorehouse = await _context.Storehouses
                .Include(s => s.Companies)
                .FirstOrDefaultAsync(s => s.StorehouseId == storehouse.StorehouseId);

            if (createdStorehouse == null)
            {
                return StatusCode(500, "Failed to retrieve the created Storehouse with Company data.");
            }

            return CreatedAtAction(nameof(GetStorehouse), new { id = createdStorehouse.StorehouseId }, createdStorehouse);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateStorehouse(int id, Storehouse storehouse)
        {


            if (id != storehouse.StorehouseId)
            {
                return BadRequest();
            }

            _context.Entry(storehouse).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!StorehouseExists(id))
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
        [Authorize(Roles = "CompanyManager")]
        public async Task<IActionResult> DeleteStorehouse(int id)
        {
            var companiesIdClaim = User.FindFirstValue("CompaniesId");
            if (!int.TryParse(companiesIdClaim, out int userCompanyId))
            {
                return Forbid();
            }

            var storehouse = await _context.Storehouses.FindAsync(id);
            if (storehouse == null)
            {
                return NotFound($"Storehouse with ID {id} not found.");
            }

            if (storehouse.CompaniesId != userCompanyId)
            {
                _logger.LogWarning("User with CompanyId {UserCompanyId} attempted to delete Storehouse {StorehouseId} belonging to CompanyId {StorehouseCompanyId}", userCompanyId, id, storehouse.CompaniesId);
                return Forbid();
            }

            _context.Storehouses.Remove(storehouse);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                _logger.LogError(ex, "Error deleting Storehouse {StorehouseId}", id);
                return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while deleting the storehouse. It might be in use.");
            }

            return NoContent();
        }

        private bool StorehouseExists(int id)
        {
            return _context.Storehouses.Any(e => e.StorehouseId == id);
        }

        [HttpGet("{id}/Sections")]
        public async Task<ActionResult<IEnumerable<Section>>> GetSectionsForStorehouse(int id)
        {
            var storehouse = await _context.Storehouses.FindAsync(id);

            if (storehouse == null)
            {
                return NotFound($"Storehouse with ID {id} not found.");
            }

            var sections = await _context.Sections
                .Where(s => s.StorehousesId == id)
                .ToListAsync();

            return Ok(sections);
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


        [HttpGet("storehouses/{id}/workers")] 
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
                    _logger.LogWarning("Storehouse with ID {StorehouseId} requested but not found.", id);
                    return NotFound(new { message = $"Storehouse with ID {id} not found." });
                }

                var workers = await _context.Users 
                    .Include(u => u.Companies)   
                    .Where(u => u.StorehouseId == id) 
                    .ToListAsync();

                if (!workers.Any())
                {
                    _logger.LogInformation("No workers found for Storehouse ID {StorehouseId}.", id);
                    return NotFound(new { message = $"No workers currently assigned to storehouse ID {id}." });
                }

                var workerDtos = workers.Select(w => new WorkerDto
                {
                    Id = w.Id,
                    CompaniesId = w.CompaniesId,
                    Username = w.UserName,
                    Email = w.Email,
                    EmailConfirmed = w.EmailConfirmed,
                    CompanyName = w.Companies?.Name,
                    CompanyBusinessNumber = w.CompanyBusinessNumber,
                    StoreHouseName = w.StorehouseName
                }).ToList();

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