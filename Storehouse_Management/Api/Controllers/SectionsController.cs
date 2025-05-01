using Application.Services.Products;
using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SectionsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<SectionsController> _logger;

        public SectionsController(AppDbContext context, ILogger<SectionsController> logger)
        {
            _context = context;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        // GET: api/Sections
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Section>>> GetSections()
        {
            return await _context.Sections.ToListAsync();
        }

        // GET: api/Sections/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Section>> GetSection(int id)
        {
            var section = await _context.Sections.FindAsync(id);

            if (section == null)
            {
                return NotFound();
            }

            return section;
        }

        // PUT: api/Sections/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSection(int id, Section section)
        {
            if (id != section.SectionId)
            {
                return BadRequest();
            }

            _context.Entry(section).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SectionExists(id))
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

        // POST: api/Sections
        [HttpPost]
        public async Task<ActionResult<Section>> PostSection(Section section)
        {
            // 1. Validate the StorehousesId
            if (!await _context.Storehouses.AnyAsync(s => s.StorehouseId == section.StorehousesId))
            {
                return BadRequest("Storehouse with specified ID does not exist.");
            }

            // 2. Get the Storehouse from the database.  We need the *actual* entity.
            var storehouse = await _context.Storehouses.FindAsync(section.StorehousesId);

            if (storehouse == null)
            {
                return NotFound("Storehouse not found."); // Double-check, just in case
            }
            section.Storehouses = null;
            // 3. Associate the Section with the existing Storehouse
            // We are *not* providing a Storehouse object in the request.
            // That is only the StorehousesId.   Let EF handle the association.

            _context.Sections.Add(section);
            await _context.SaveChangesAsync();

            // 4. Retrieve the created Section *with* the Storehouse data
            var createdSection = await _context.Sections
                .Include(s => s.Storehouses)
                .ThenInclude(c => c.Companies) // Include company data as well
                .FirstOrDefaultAsync(s => s.SectionId == section.SectionId);

            if (createdSection == null)
            {
                return StatusCode(500, "Failed to retrieve the created Section with Storehouse data.");
            }

            // 5. Return the CreatedAtAction result
            return CreatedAtAction(nameof(GetSection), new { id = createdSection.SectionId }, createdSection);
        }

        // DELETE: api/Sections/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSection(int id)
        {
            var section = await _context.Sections.FindAsync(id);
            if (section == null)
            {
                return NotFound();
            }

            _context.Sections.Remove(section);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SectionExists(int id)
        {
            return _context.Sections.Any(e => e.SectionId == id);
        }
    }
}