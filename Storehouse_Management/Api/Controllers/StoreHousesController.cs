using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class StorehousesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public StorehousesController(AppDbContext context)
        {
            _context = context;
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
                return StatusCode(500, "Failed to retrieve the created Storehouse with Company data."); // Handle potential error
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
                return NotFound("Storehouse not found.");
            }

            var sections = await _context.Sections
                .Where(s => s.StorehousesId == id)
                .ToListAsync();

            return sections;
        }
    }
}
