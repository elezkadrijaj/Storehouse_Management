// In WorkContractController.cs
using Application.DTOs; // Ensure this is present
using Core.Entities;    // Ensure this is present
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging; // For ILogger

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class WorkContractController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<WorkContractController> _logger;

        public WorkContractController(AppDbContext context, ILogger<WorkContractController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // ... (your other methods like GetWorkContract, GetRequests, CreateWorkContract, etc.)

        [HttpGet("user/{userId}")]
        [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(WorkContractDto))]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult<WorkContractDto>> GetWorkContractByUserId(string userId)
        {
            if (string.IsNullOrEmpty(userId))
            {
                _logger?.LogWarning("GetWorkContractByUserId called with empty or null userId.");
                return BadRequest(new { message = "User ID cannot be empty." });
            }

            _logger?.LogInformation("Attempting to find contract for User ID: {UserId}", userId);

            // It's common for a user to have only one active contract,
            // or you might want the most recent one.
            // OrderByDescending by StartDate or a CreationDate if you have one.
            var contract = await _context.WorkContract
                                         .AsNoTracking() // Good for read-only operations
                                         .Where(wc => wc.UserId == userId)
                                         .OrderByDescending(wc => wc.StartDate) // Gets the latest if multiple exist
                                         .FirstOrDefaultAsync();

            if (contract == null)
            {
                _logger?.LogWarning("No work contract found for User ID: {UserId}", userId);
                return NotFound(new { message = $"No work contract found for user ID {userId}." });
            }

            // --- THIS IS THE CRITICAL FIX ---
            // Map the found entity properties to the DTO
            var contractDto = new WorkContractDto
            {
                WorkContractId = contract.WorkContractId,
                UserId = contract.UserId,
                StartDate = contract.StartDate,
                EndDate = contract.EndDate,
                Salary = contract.Salary,
                ContractFileUrl = contract.ContractFileUrl
                // Add any other properties from WorkContract entity that are in WorkContractDto
            };
            // --- END OF CRITICAL FIX ---

            _logger?.LogInformation("Successfully found and mapped contract for User ID {UserId}. Contract ID: {ContractId}", userId, contractDto.WorkContractId);
            return Ok(contractDto);
        }

        // ... (your other methods like UpdateWorkContract, DeleteWorkContract, WorkContractExists)
        [HttpGet("{id:int}", Name = "GetWorkContractById")]
        public async Task<ActionResult<WorkContractDto>> GetWorkContract(int id)
        {
            var contract = await _context.WorkContract.FindAsync(id);

            if (contract == null)
            {
                return NotFound(new { message = $"Work contract with ID {id} not found." });
            }

            var contractDto = new WorkContractDto
            {
                WorkContractId = contract.WorkContractId,
                UserId = contract.UserId,
                StartDate = contract.StartDate,
                EndDate = contract.EndDate,
                Salary = contract.Salary,
                ContractFileUrl = contract.ContractFileUrl
            };
            return Ok(contractDto);
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<WorkContractDto>>> GetRequests() // Changed to return DTOs
        {
            var contracts = await _context.WorkContract
                                        .AsNoTracking()
                                        .Select(contract => new WorkContractDto
                                        {
                                            WorkContractId = contract.WorkContractId,
                                            UserId = contract.UserId,
                                            StartDate = contract.StartDate,
                                            EndDate = contract.EndDate,
                                            Salary = contract.Salary,
                                            ContractFileUrl = contract.ContractFileUrl
                                        })
                                        .ToListAsync();
            return Ok(contracts);
        }


        [HttpPost, Authorize(Policy = "StorehouseAccessPolicy")] // Assuming CompanyManager has this policy
        [ProducesResponseType(StatusCodes.Status201Created, Type = typeof(WorkContractDto))]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<ActionResult<WorkContractDto>> CreateWorkContract([FromBody] WorkContractDto contractDto)
        {
            if (!ModelState.IsValid) // Rely on [ApiController] for automatic model state validation
            {
                return BadRequest(ModelState);
            }

            // Additional validation: Check if user exists
            var userExists = await _context.Users.AnyAsync(u => u.Id == contractDto.UserId);
            if (!userExists)
            {
                ModelState.AddModelError("UserId", $"User with ID '{contractDto.UserId}' not found.");
                return BadRequest(ModelState);
            }

            // Check if a contract already exists for this user to prevent duplicates if that's a business rule
            // bool contractExistsForUser = await _context.WorkContract.AnyAsync(wc => wc.UserId == contractDto.UserId);
            // if (contractExistsForUser)
            // {
            //     ModelState.AddModelError("UserId", $"A contract already exists for user ID '{contractDto.UserId}'. Consider updating the existing one.");
            //     return Conflict(ModelState); // Or BadRequest
            // }


            var contract = new WorkContract
            {
                // WorkContractId will be generated by the database
                UserId = contractDto.UserId,
                StartDate = contractDto.StartDate,
                EndDate = contractDto.EndDate,
                Salary = contractDto.Salary,
                ContractFileUrl = contractDto.ContractFileUrl
            };

            _context.WorkContract.Add(contract);
            await _context.SaveChangesAsync();

            // Map back to DTO for the response, now with the generated WorkContractId
            var createdContractDto = new WorkContractDto
            {
                WorkContractId = contract.WorkContractId,
                UserId = contract.UserId,
                StartDate = contract.StartDate,
                EndDate = contract.EndDate,
                Salary = contract.Salary,
                ContractFileUrl = contract.ContractFileUrl
            };

            return CreatedAtAction(nameof(GetWorkContract), new { id = createdContractDto.WorkContractId }, createdContractDto);
        }

        [HttpPut("{id:int}")] // Ensure id is an int
        [Authorize(Policy = "StorehouseAccessPolicy")] // Assuming CompanyManager has this policy
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> UpdateWorkContract(int id, [FromBody] WorkContractDto workContractDto)
        {
            if (id != workContractDto.WorkContractId)
            {
                _logger?.LogWarning("Mismatched ID in UpdateWorkContract. Route ID: {RouteId}, DTO ID: {DtoId}", id, workContractDto.WorkContractId);
                return BadRequest(new { message = "Contract ID in URL must match Contract ID in request body." });
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var workContract = await _context.WorkContract.FindAsync(id);

            if (workContract == null)
            {
                _logger?.LogWarning("WorkContract with ID {ContractId} not found for update.", id);
                return NotFound(new { message = $"Work contract with ID {id} not found." });
            }

            // Additional validation: Check if user exists if UserId is being changed (though often UserId isn't changed in an update)
            if (workContract.UserId != workContractDto.UserId) // If UserId can be changed
            {
                var userExists = await _context.Users.AnyAsync(u => u.Id == workContractDto.UserId);
                if (!userExists)
                {
                    ModelState.AddModelError("UserId", $"User with ID '{workContractDto.UserId}' not found.");
                    return BadRequest(ModelState);
                }
            }


            // Update properties from DTO
            workContract.UserId = workContractDto.UserId; // Be cautious if this is allowed to change
            workContract.StartDate = workContractDto.StartDate;
            workContract.EndDate = workContractDto.EndDate;
            workContract.Salary = workContractDto.Salary;
            workContract.ContractFileUrl = workContractDto.ContractFileUrl; // Ensure this is updated too

            // _context.Entry(workContract).State = EntityState.Modified; // EF Core tracks changes automatically if the entity was fetched from the context

            try
            {
                await _context.SaveChangesAsync();
                _logger?.LogInformation("WorkContract with ID {ContractId} updated successfully.", id);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                if (!WorkContractExists(id))
                {
                    _logger?.LogError(ex, "Concurrency error: WorkContract with ID {ContractId} not found during update.", id);
                    return NotFound(new { message = $"Work contract with ID {id} not found (concurrency)." });
                }
                else
                {
                    _logger?.LogError(ex, "Concurrency error while updating WorkContract ID {ContractId}.", id);
                    throw; // Re-throw if it's a genuine concurrency issue you want to handle globally
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error updating WorkContract with ID {ContractId}", id);
                return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while updating the contract.");
            }

            return NoContent(); // Standard for successful PUT
        }


        [HttpDelete("{id:int}")] // Ensure id is an int
        [Authorize(Policy = "StorehouseAccessPolicy")] // Assuming CompanyManager has this policy
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> DeleteWorkContract(int id)
        {
            var workContract = await _context.WorkContract.FindAsync(id);

            if (workContract == null)
            {
                _logger?.LogWarning("WorkContract with ID {ContractId} not found for deletion.", id);
                return NotFound(new { message = $"Work contract with ID {id} not found." });
            }

            _context.WorkContract.Remove(workContract);

            try
            {
                await _context.SaveChangesAsync();
                _logger?.LogInformation("WorkContract with ID {ContractId} deleted successfully.", id);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error deleting WorkContract with ID {ContractId}", id);
                return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while deleting the contract.");
            }

            return NoContent();
        }

        private bool WorkContractExists(int id)
        {
            return _context.WorkContract.Any(e => e.WorkContractId == id);
        }
    }
}