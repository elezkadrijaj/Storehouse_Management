using Application.DTOs;
using Application.Interfaces;
using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims; // E nevojshme për të marrë të dhënat e userit të kyçur
using System.Threading.Tasks;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // Kërkon që përdoruesi të jetë i kyçur për të gjitha veprimet
    public class LeaveRequestController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IGetManagerService _getManagerService;

        public LeaveRequestController(AppDbContext context, IGetManagerService getManagerService)
        {
            _context = context;
            _getManagerService = getManagerService;
        }

        /// <summary>
        /// Kthen një listë të kërkesave për pushim VETËM për kompaninë e përdoruesit të kyçur.
        /// </summary>
        [HttpGet, Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<ActionResult<IEnumerable<LeaveRequest>>> GetRequests()
        {
            // 1. Merr ID-në e përdoruesit të kyçur nga token-i (claim)
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserId))
            {
                return Unauthorized("User ID could not be found in token.");
            }

            // 2. Gjej përdoruesin në databazë për të marrë CompaniesId-në e tij
            var currentUser = await _context.Users.FindAsync(currentUserId);
            if (currentUser == null || currentUser.CompaniesId == null)
            {
                return BadRequest("The logged-in user is not associated with any company.");
            }

            // 3. Filtro kërkesat e pushimit bazuar në CompaniesId-në e përdoruesit
            var companyRequests = await _context.LeaveRequest
                .Where(lr => lr.CompanyId == currentUser.CompaniesId)
                .Include(lr => lr.ApplicationUser) // Përfshin detajet e përdoruesit që bëri kërkesën
                .Include(lr => lr.ApplicationUserMenager) // Përfshin detajet e menaxherit
                .ToListAsync();

            return Ok(companyRequests);
        }

        /// <summary>
        /// Kthen një kërkesë të vetme për pushim, duke verifikuar që i përket kompanisë së përdoruesit.
        /// </summary>
        [HttpGet("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<ActionResult<LeaveRequest>> GetRequest(int id)
        {
            // Merret CompaniesId e përdoruesit të kyçur për siguri
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var currentUser = await _context.Users.FindAsync(currentUserId);
            if (currentUser == null || currentUser.CompaniesId == null)
            {
                return BadRequest("The logged-in user is not associated with any company.");
            }

            // Gjej kërkesën duke kontrolluar ID-në e saj DHE CompaniesId-në
            var request = await _context.LeaveRequest
                .Include(lr => lr.ApplicationUser)
                .Include(lr => lr.ApplicationUserMenager)
                .FirstOrDefaultAsync(lr => lr.LeaveRequestId == id && lr.CompanyId == currentUser.CompaniesId);

            if (request == null)
            {
                // Kthehet NotFound nëse kërkesa nuk ekziston OSE i përket një kompanie tjetër
                return NotFound();
            }

            return Ok(request);
        }


        /// <summary>
        /// Krijon një kërkesë të re për pushim dhe e lidh automatikisht me kompaninë e përdoruesit.
        /// </summary>
        [HttpPost, Authorize(Policy = "WorkerAccessPolicy")]
        public async Task<ActionResult<LeaveRequest>> CreateRequest(LeaveRequestDto requestDto)
        {
            // 1. Gjej përdoruesin për të cilin po bëhet kërkesa, për të marrë CompaniesId-në e tij
            var userMakingRequest = await _context.Users.FindAsync(requestDto.UserId);
            if (userMakingRequest == null || userMakingRequest.CompaniesId == null)
            {
                return BadRequest("The user for whom the request is being made is not valid or not assigned to a company.");
            }

            // 2. Merr menaxherin e parë të kompanisë (logjika juaj ekzistuese)
            ApplicationUser? companyManager = await _getManagerService.GetFirstCompanyManagerAsync();
            if (companyManager == null)
            {
                ModelState.AddModelError("ManagerAssignment", "No Company Manager found to assign the leave request.");
                return BadRequest(ModelState);
            }

            // 3. Krijo objektin e ri LeaveRequest, duke përfshirë CompaniesId
            var leaveRequest = new LeaveRequest
            {
                UserId = requestDto.UserId,
                StartDate = requestDto.StartDate,
                EndDate = requestDto.EndDate,
                Description = requestDto.Description,
                ManagerId = companyManager.Id,
                CompanyId = userMakingRequest.CompaniesId.Value // Lidh kërkesën me kompaninë e përdoruesit
            };

            _context.LeaveRequest.Add(leaveRequest);
            await _context.SaveChangesAsync();

            // Kthe përgjigje me objektin e ri të krijuar
            return CreatedAtAction(nameof(GetRequest), new { id = leaveRequest.LeaveRequestId }, leaveRequest);
        }
        [HttpDelete("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> DeleteRequest(int id)
        {
            // Merret CompaniesId e përdoruesit të kyçur për siguri
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var currentUser = await _context.Users.FindAsync(currentUserId);
            if (currentUser == null || currentUser.CompaniesId == null)
            {
                return BadRequest("The logged-in user is not associated with any company.");
            }

            // Gjej kërkesën duke kontrolluar ID-në e saj DHE CompaniesId-në e menaxherit
            var requestToDelete = await _context.LeaveRequest
                .FirstOrDefaultAsync(lr => lr.LeaveRequestId == id && lr.CompanyId == currentUser.CompaniesId);

            if (requestToDelete == null)
            {
                // Kthehet NotFound nëse kërkesa nuk ekziston OSE i përket një kompanie tjetër
                return NotFound("Leave request not found or you do not have permission to delete it.");
            }

            _context.LeaveRequest.Remove(requestToDelete);
            await _context.SaveChangesAsync();

            // Kthehet NoContent (204) që tregon se fshirja u krye me sukses pa përmbajtje për t'u kthyer
            return NoContent();
        }
    }
}