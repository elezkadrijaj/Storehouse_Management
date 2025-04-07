using System.Security.Claims;
using Application.DTOs;
using Application.Services.Account;
using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AccountController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly LoginFeatures _loginFeature;
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _context;

        public AccountController(UserManager<ApplicationUser> userManager, RoleManager<IdentityRole> roleManager, IConfiguration configuration, LoginFeatures loginFeature, AppDbContext context)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _configuration = configuration;
            _loginFeature = loginFeature;
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAllUsers()
        {
            try
            {
                var users = _userManager.Users.ToList();

                if (!users.Any())
                {
                    return NotFound("No users found.");
                }

                var userDtos = new List<object>();
                foreach (var user in users)
                {
                    var roles = await _userManager.GetRolesAsync(user);
                    userDtos.Add(new
                    {
                        user.Id,
                        user.UserName,
                        user.Email,
                        Roles = roles
                    });
                }

                return Ok(userDtos);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred while fetching users", error = ex.Message });
            }
        }

        [HttpPost("register-worker")]
        public async Task<IActionResult> RegisterWorker([FromBody] RegisterWorkerDto model)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                // Check if username already exists
                var existingUser = await _userManager.FindByNameAsync(model.Username);
                if (existingUser != null)
                    return BadRequest(new { message = "Username is already taken." });

                // Check if email already exists
                var existingEmail = await _userManager.FindByEmailAsync(model.Email);
                if (existingEmail != null)
                    return BadRequest(new { message = "Email is already registered." });

                // Find the company using the provided business number
                var company = await _context.Companies
                    .FirstOrDefaultAsync(c => c.Numer_Biznesit == model.CompanyBusinessNumber);
                if (company == null)
                    return BadRequest(new { message = "Invalid company business number." });

                // Find the storehouse by name and ensure it belongs to the same company
                var storehouse = await _context.Storehouses
                    .FirstOrDefaultAsync(s => s.StorehouseName == model.StorehouseName && s.CompaniesId == company.CompanyId);
                if (storehouse == null)
                    return BadRequest(new { message = "Invalid storehouse name for the provided company." });

                // Create the user and connect with company and storehouse
                var user = new ApplicationUser
                {
                    UserName = model.Username,
                    Email = model.Email,
                    CompaniesId = company.CompanyId,
                    EmailConfirmed = false,
                    CompanyBusinessNumber = company.Numer_Biznesit,
                    StorehouseId = storehouse.StorehouseId, 
                    StorehouseName = storehouse.StorehouseName
                };

                var result = await _userManager.CreateAsync(user, model.Password);
                if (!result.Succeeded)
                    return BadRequest(result.Errors);

                // Automatically assign the "Worker" role to the user
                var roleResult = await _userManager.AddToRoleAsync(user, "Worker");
                if (!roleResult.Succeeded)
                    return BadRequest(new { message = "User created, but failed to assign role.", errors = roleResult.Errors });

                return Ok(new { message = "Worker registered successfully. Awaiting confirmation from the company manager." });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "An error occurred during registration",
                    error = ex.Message,
                    innerException = ex.InnerException?.Message
                });
            }
        }


        [HttpPost("register-manager")]
        public async Task<IActionResult> RegisterManager([FromBody] RegisterManagerDto model)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var existingUser = await _userManager.FindByNameAsync(model.Username);
                if (existingUser != null)
                    return BadRequest(new { message = "Username is already taken." });

                var existingEmail = await _userManager.FindByEmailAsync(model.Email);
                if (existingEmail != null)
                    return BadRequest(new { message = "Email is already registered." });

                // Find the company based on the provided business number
                var company = await _context.Companies.FirstOrDefaultAsync(c => c.Numer_Biznesit == model.CompanyBusinessNumber);
                if (company == null)
                    return BadRequest(new { message = "Invalid company business number." });

                var user = new ApplicationUser
                {
                    UserName = model.Username,
                    Email = model.Email,
                    EmailConfirmed = true, 
                    CompaniesId = company.CompanyId, 
                    CompanyBusinessNumber = company.Numer_Biznesit 
                };

                var result = await _userManager.CreateAsync(user, model.Password);

                if (result.Succeeded)
                {
                    await _userManager.AddToRoleAsync(user, "CompanyManager");
                    return Ok(new { message = "Company manager registered successfully" });
                }

                return BadRequest(result.Errors);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "An error occurred during registration",
                    error = ex.Message,
                    innerException = ex.InnerException?.Message
                });
            }
        }

        [HttpPost("confirm-email")]
        [Authorize(Roles = "CompanyManager")]
        public async Task<IActionResult> ConfirmEmail([FromBody] ConfirmEmailDto model)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var user = await _userManager.FindByEmailAsync(model.WorkerEmail);
                if (user == null)
                    return NotFound(new { message = "Worker not found." });

                user.EmailConfirmed = true;
                var result = await _userManager.UpdateAsync(user);

                if (result.Succeeded)
                {
                    return Ok(new { message = "Worker email confirmed successfully." });
                }

                return BadRequest(result.Errors);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "An error occurred while confirming the email",
                    error = ex.Message,
                    innerException = ex.InnerException?.Message
                });
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] Login loginDTO)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var result = await _loginFeature.AuthenticateUser(loginDTO);

                if (!result.IsSuccess)
                {
                    return Unauthorized(new { message = result.ErrorMessage });
                }

                return Ok(new { token = result.Token });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred during login", error = ex.Message });
            }
        }

        [HttpPost("logout")]
        public IActionResult Logout()
        {
            try
            {
                if (Request.Cookies.ContainsKey("refreshToken"))
                {
                    Response.Cookies.Delete("refreshToken");
                }

                return Ok(new { message = "User logged out successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred during logout", error = ex.Message });
            }
        }

        [HttpPost("add-role")]
        public async Task<IActionResult> AddRole([FromBody] string role)
        {
            try
            {
                if (!await _roleManager.RoleExistsAsync(role))
                {
                    var result = await _roleManager.CreateAsync(new IdentityRole(role));
                    if (result.Succeeded)
                    {
                        return Ok(new { message = "Role added successfully" });
                    }

                    return BadRequest(result.Errors);
                }

                return BadRequest("Role already exists");
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred while adding the role", error = ex.Message });
            }
        }

        [HttpPost("assign-role")]
        public async Task<IActionResult> AssignRole([FromBody] AssignRoleDto model)
        {
            try
            {
                var user = await _userManager.FindByNameAsync(model.Username);
                if (user == null)
                {
                    return BadRequest("User not found");
                }

                var currentRoles = await _userManager.GetRolesAsync(user);

                var removeRolesResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);
                if (!removeRolesResult.Succeeded)
                {
                    return BadRequest(new { message = "Failed to remove user's current roles", errors = removeRolesResult.Errors });
                }

                var addRoleResult = await _userManager.AddToRoleAsync(user, model.Role);
                if (addRoleResult.Succeeded)
                {
                    return Ok(new { message = "Role updated successfully" });
                }

                return BadRequest(new { message = "Failed to assign the new role", errors = addRoleResult.Errors });
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred while assigning the role", error = ex.Message });
            }

        }

        [HttpGet("manager-by-business-number/{businessNumber}")]
        [Authorize(Roles = "CompanyManager")] // Restrict to CompanyManagers (or adjust as needed)
        public async Task<IActionResult> GetCompanyManagerByBusinessNumber(string businessNumber)
        {
            try
            {
                if (string.IsNullOrEmpty(businessNumber))
                {
                    return BadRequest("Business number cannot be empty.");
                }

                // Find the user based on the business number
                var manager = await _userManager.Users
                    .FirstOrDefaultAsync(u => u.CompanyBusinessNumber == businessNumber);

                if (manager == null)
                {
                    return NotFound("Company manager not found with the specified business number.");
                }

                // Check if the user is in the CompanyManager role *after* retrieval
                if (!await _userManager.IsInRoleAsync(manager, "CompanyManager"))
                {
                    return NotFound("User is not a Company Manager.");
                }

                // Create a DTO to return the manager's information (avoid exposing sensitive data)
                var managerDto = new CompanyManagerDto
                {
                    Id = manager.Id,
                    Username = manager.UserName,
                    Email = manager.Email,
                    CompanyBusinessNumber = manager.CompanyBusinessNumber,
                    //Add CompaniesId if needed
                    //CompaniesId = manager.CompaniesId
                };

                return Ok(managerDto);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred while fetching the company manager", error = ex.Message });
            }
        }

        [HttpGet("all-workers/{businessNumber}")]
        [Authorize(Roles = "CompanyManager")] 
        public async Task<IActionResult> GetAllWorkersByBusinessNumber(string businessNumber)
        {
            try
            {
                if (string.IsNullOrEmpty(businessNumber))
                {
                    return BadRequest("Business number cannot be empty.");
                }

                // --- CORRECTED QUERY ---
                // Retrieve users WITH their related Companies data
                var allUsers = await _userManager.Users
                    .Include(u => u.Companies) // <--- ADD THIS .Include() METHOD
                    .Where(u => u.CompanyBusinessNumber == businessNumber)
                    .ToListAsync();
                // --- END CORRECTION ---

                // Filter out the CompanyManagers (consider efficiency improvements if needed)
                var workers = new List<ApplicationUser>(); // Initialize list
                foreach (var user in allUsers)
                {
                    if (!await _userManager.IsInRoleAsync(user, "CompanyManager"))
                    {
                        workers.Add(user);
                    }
                }

                if (!workers.Any())
                {
                    return NotFound($"No workers (excluding managers) found for business number: {businessNumber}.");
                }


                var workerDtos = new List<WorkerDto>();
                foreach (var worker in workers)
                {
                    workerDtos.Add(new WorkerDto
                    {
                        Id = worker.Id,
                        Username = worker.UserName,
                        Email = worker.Email,
                        EmailConfirmed = worker.EmailConfirmed,
                        CompanyName = worker.Companies?.Name,
                        CompanyBusinessNumber = worker.CompanyBusinessNumber,
                        CompaniesId = worker.CompaniesId,
                        StoreHouseName = worker.StorehouseName
                    });
                }

                return Ok(workerDtos);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred while fetching workers", error = ex.Message });
            }
        }
        

    }
}

