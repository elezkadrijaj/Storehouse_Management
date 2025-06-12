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
    [Authorize(Policy = "WorkerAccessPolicy")]
    public class SectionsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<SectionsController> _logger;

        public SectionsController(AppDbContext context, ILogger<SectionsController> logger)
        {
            _context = context;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Section>>> GetSections()
        {
            return await _context.Sections.ToListAsync();
        }

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

        [HttpPost]
        public async Task<ActionResult<Section>> PostSection(Section section)
        {
            if (!await _context.Storehouses.AnyAsync(s => s.StorehouseId == section.StorehousesId))
            {
                return BadRequest("Storehouse with specified ID does not exist.");
            }

            var storehouse = await _context.Storehouses.FindAsync(section.StorehousesId);

            if (storehouse == null)
            {
                return NotFound("Storehouse not found."); 
            }
            section.Storehouses = null;


            _context.Sections.Add(section);
            await _context.SaveChangesAsync();

            var createdSection = await _context.Sections
                .Include(s => s.Storehouses)
                .ThenInclude(c => c.Companies) 
                .FirstOrDefaultAsync(s => s.SectionId == section.SectionId);

            if (createdSection == null)
            {
                return StatusCode(500, "Failed to retrieve the created Section with Storehouse data.");
            }

            return CreatedAtAction(nameof(GetSection), new { id = createdSection.SectionId }, createdSection);
        }

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