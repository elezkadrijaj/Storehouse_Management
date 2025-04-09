using Application.DTOs;
using Core.Entities;
using Infrastructure.Data;
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
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Schedule>>> GetRequests()
        {
            return await _context.Schedule.ToListAsync();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Schedule>> GetSchedule(int id)
        {
            var schedule = await _context.Schedule.FindAsync(id);

            if (schedule == null)
            {
                return NotFound();
            }

            return schedule;
        }
        [HttpPost]
        public async Task<ActionResult<Schedule>> CreateSchedule(ScheduleDto scheduleDto)
        {
            var schedule = new Schedule
            {
                ScheduleId = scheduleDto.ScheduleId,
                UserId = scheduleDto.UserId,
                StartDate = scheduleDto.StartDate,
                EndDate = scheduleDto.EndDate,
                BreakTime = scheduleDto.BreakTime
            };

            _context.Schedule.Add(schedule);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetSchedule), new { id = schedule.ScheduleId }, schedule);
        }
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateSchedule(int id, ScheduleDto scheduleDto)
        {
            if (id != scheduleDto.ScheduleId)
            {
                return BadRequest();
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

        [HttpDelete("{id}")]
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
