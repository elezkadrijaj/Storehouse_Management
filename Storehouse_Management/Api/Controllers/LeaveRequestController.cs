using Application.DTOs;
using Application.Interfaces;
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
        private readonly IGetManagerService _getManagerService;

        public LeaveRequestController(AppDbContext context, IGetManagerService getManagerService)
        {
            _context = context;
            _getManagerService = getManagerService;
        }

        [HttpGet, Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<ActionResult<IEnumerable<LeaveRequest>>> GetRequests()
        {
            return await _context.LeaveRequest.ToListAsync();
        }

        [HttpGet("{id}"), Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<ActionResult<LeaveRequest>> GetRequest(int id)
        {
            var request = await _context.LeaveRequest.FindAsync(id);

            if (request == null)
            {
                return NotFound();
            }

            return request;
        }

        [HttpPost, Authorize(Policy = "WorkerAccessPolicy")]
        public async Task<ActionResult<LeaveRequest>> CreateRequest(LeaveRequestDto requestDto)
        {

            ApplicationUser? companyManager = await _getManagerService.GetFirstCompanyManagerAsync();

            if (companyManager == null)
            {
                // Handle the case where no Company Manager is found.
                // This could be due to no users having the role, or the role not existing.
                // You might want to log this error and return a specific response.
                ModelState.AddModelError("ManagerAssignment", "No Company Manager found to assign the leave request.");
                return BadRequest(ModelState); // Or UnprocessableEntity, or a custom error response
            }

            var leaveRequest = new LeaveRequest
            {
                UserId = requestDto.UserId,
                StartDate = requestDto.StartDate,
                EndDate = requestDto.EndDate,
                Description = requestDto.Description,
                ManagerId = companyManager.Id

            };

            _context.LeaveRequest.Add(leaveRequest);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetRequest), new { id = leaveRequest.LeaveRequestId }, leaveRequest);
        }

    }
}
