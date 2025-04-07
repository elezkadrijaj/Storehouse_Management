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
    public class LeaveRequestController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LeaveRequestController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet, Authorize(Policy = "StorehouseWorkerPolicy, CompanyManagerPolicy")]
        public async Task<ActionResult<IEnumerable<LeaveRequest>>> GetRequests()
        {
            return await _context.LeaveRequest.ToListAsync();
        }

        [HttpGet("{id}"), Authorize(Policy = "StorehouseWorkerPolicy, CompanyManagerPolicy")]
        public async Task<ActionResult<LeaveRequest>> GetRequest(int id)
        {
            var request = await _context.LeaveRequest.FindAsync(id);

            if (request == null)
            {
                return NotFound();
            }

            return request;
        }

        [HttpPost, Authorize(Policy = "StorehouseWorkerPolicy, CompanyManagerPolicy")]
        public async Task<ActionResult<LeaveRequest>> CreateRequest(LeaveRequestDto requestDto)
        {
            
            var leaveRequest = new LeaveRequest
            {
                UserId = requestDto.UserId,
                StartDate = requestDto.StartDate,
                EndDate = requestDto.EndDate,
                Status = requestDto.Status,
                ManagerId = requestDto.ManagerId
                
            };

            _context.LeaveRequest.Add(leaveRequest);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetRequest), new { id = leaveRequest.LeaveRequestId }, leaveRequest);
        }

    }
}
