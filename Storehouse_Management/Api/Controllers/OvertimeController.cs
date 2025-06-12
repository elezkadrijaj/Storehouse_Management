using Application.DTOs;
using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Policy = "WorkerAccessPolicy")]
    public class OvertimeController : ControllerBase
    {
        private readonly AppDbContext _context;

        public OvertimeController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Overtime>>> GetOvertimes()
        {
            return await _context.Overtimes.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Overtime>> GetOvertime(int id)
        {
            var overtime = await _context.Overtimes.FindAsync(id);

            if (overtime == null)
            {
                return NotFound();
            }

            return overtime;
        }

        [HttpPost]
        public async Task<ActionResult<Overtime>> CreateOvertime(OvertimeDto overtimeDto)
        {

            var overtime = new Overtime
            {
                OvertimeId = overtimeDto.OvertimeId,
                UserId = overtimeDto.UserId,
                Date = overtimeDto.Date,
                HoursWorked = overtimeDto.HoursWorked,
            };

            _context.Overtimes.Add(overtime);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetOvertime), new { id = overtime.OvertimeId }, overtime);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateOvertime(int id, OvertimeDto overtimeDto)
        {
            
            if (id != overtimeDto.OvertimeId)
            {
                return BadRequest();
            }

            
            var overtime = await _context.Overtimes.FindAsync(id);

            if (overtime == null)
            {
                return NotFound();
            }

            overtime.UserId = overtimeDto.UserId;
            overtime.Date = overtimeDto.Date;
            overtime.HoursWorked = overtimeDto.HoursWorked;

            _context.Entry(overtime).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!OvertimeExists(id))
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
        public async Task<IActionResult> DeleteOvertime(int id)
        {
            var overtime = await _context.Overtimes.FindAsync(id);

            if (overtime == null)
            {
                return NotFound();
            }

            _context.Overtimes.Remove(overtime);

            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool OvertimeExists(int id)
        {
            return _context.Overtimes.Any(e => e.OvertimeId == id);
        }
    }

}
