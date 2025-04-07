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
    public class WorkContractController : ControllerBase
    {
        private readonly AppDbContext _context;
        public WorkContractController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet, Authorize(Policy = "CompanyManagerPolicy")]
        public async Task<ActionResult<IEnumerable<WorkContract>>> GetRequests()
        {
            return await _context.WorkContract.ToListAsync();
        }

        [HttpGet("{id}"), Authorize(Policy = "CompanyManagerPolicy")]
        public async Task<ActionResult<WorkContract>> GetRequest(int id)
        {
            var contract = await _context.WorkContract.FindAsync(id);

            if (contract == null)
            {
                return NotFound();
            }

            return contract;
        }

        [HttpPost, Authorize(Policy = "CompanyManagerPolicy")]
        public async Task<ActionResult<LeaveRequest>> CreateRequest(WorkContractDto contractDto)
        {

            var contract = new WorkContract
            {
                WorkContractId = contractDto.WorkContractId,
                UserId = contractDto.UserId,
                StartDate = contractDto.StartDate,
                EndDate = contractDto.EndDate,
                Salary = contractDto.Salary,
                ContractFileUrl = contractDto.ContractFileUrl

            };

            _context.WorkContract.Add(contract);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetRequest), new { id = contract.WorkContractId }, contract);
        }

        [HttpPut("{id}"), Authorize(Policy = "CompanyManagerPolicy")]
        public async Task<IActionResult> UpdateWorkContract(int id, WorkContractDto workContractDto)
        {
            if (id != workContractDto.WorkContractId)
            {
                return BadRequest();
            }

            var workContract = await _context.WorkContract.FindAsync(id);

            if (workContract == null)
            {
                return NotFound();
            }

            workContract.UserId = workContractDto.UserId;
            workContract.StartDate = workContractDto.StartDate;
            workContract.EndDate = workContractDto.EndDate;
            workContract.Salary = workContractDto.Salary;

            _context.Entry(workContract).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!WorkContractExists(id))
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

        [HttpDelete("{id}"), Authorize(Policy = "CompanyManagerPolicy")]
        public async Task<IActionResult> DeleteWorkContract(int id)
        {
            var workContract = await _context.WorkContract.FindAsync(id);

            if (workContract == null)
            {
                return NotFound();
            }

            _context.WorkContract.Remove(workContract);
            await _context.SaveChangesAsync();

            return NoContent();
        }


        private bool WorkContractExists(int id)
        {
            return _context.WorkContract.Any(e => e.WorkContractId == id);
        }

    }
}
