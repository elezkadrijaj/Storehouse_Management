using Application.DTOs;
using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ScheduleController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ScheduleController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Schedule
        [HttpGet, Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<ActionResult<IEnumerable<Schedule>>> GetSchedules()
        {
            return await _context.Schedule.ToListAsync();
        }

        [HttpGet("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<ActionResult<Schedule>> GetSchedule(int id)
        {
            var schedule = await _context.Schedule.FindAsync(id);

            if (schedule == null)
            {
                return NotFound();
            }

            return schedule;
        }

        [HttpGet("user/{userId}"), Authorize(Policy = "WorkerAccessPolicy")]
        public async Task<ActionResult<Schedule>> GetScheduleByUserId(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return BadRequest("User ID cannot be empty.");
            }

            var schedule = await _context.Schedule
                                       .FirstOrDefaultAsync(s => s.UserId == userId);

            if (schedule == null)
            {
                return NotFound($"No schedule found for user ID '{userId}'.");
            }

            return Ok(schedule);
        }

        // POST: api/Schedule
        // This method is now corrected to use the GetSchedule(int id) endpoint.
        [HttpPost, Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<ActionResult<Schedule>> CreateSchedule(ScheduleDto scheduleDto)
        {
            if (!Guid.TryParse(scheduleDto.UserId, out _))
            {
                return BadRequest("Invalid UserId format.");
            }

            var schedule = new Schedule
            {
                UserId = scheduleDto.UserId,
                StartDate = scheduleDto.StartDate,
                EndDate = scheduleDto.EndDate,
                BreakTime = scheduleDto.BreakTime
            };

            _context.Schedule.Add(schedule);
            await _context.SaveChangesAsync();

            // Correctly points to the GetSchedule(int id) endpoint with the new ID.
            return CreatedAtAction(nameof(GetSchedule), new { id = schedule.ScheduleId }, schedule);
        }

        // PUT: api/Schedule/5
        [HttpPut("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> UpdateSchedule(int id, ScheduleDto scheduleDto)
        {
            if (id != scheduleDto.ScheduleId)
            {
                return BadRequest("The ID in the URL does not match the ID in the request body.");
            }

            var schedule = await _context.Schedule.FindAsync(id);

            if (schedule == null)
            {
                return NotFound();
            }

            schedule.UserId = scheduleDto.UserId;
            schedule.StartDate = scheduleDto.StartDate;
            schedule.EndDate = scheduleDto.EndDate;
            schedule.BreakTime = scheduleDto.BreakTime;

            _context.Entry(schedule).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!ScheduleExists(id))
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

        // DELETE: api/Schedule/5
        [HttpDelete("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> DeleteSchedule(int id)
        {
            var schedule = await _context.Schedule.FindAsync(id);

            if (schedule == null)
            {
                return NotFound();
            }

            _context.Schedule.Remove(schedule);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool ScheduleExists(int id)
        {
            return _context.Schedule.Any(e => e.ScheduleId == id);
        }
    }
}