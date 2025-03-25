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

                var existingUser = await _userManager.FindByNameAsync(model.Username);
                if (existingUser != null)
                    return BadRequest(new { message = "Username is already taken." });

                var existingEmail = await _userManager.FindByEmailAsync(model.Email);
                if (existingEmail != null)
                    return BadRequest(new { message = "Email is already registered." });

                var company = await _context.Companies.FirstOrDefaultAsync(c => c.Numer_Biznesit == model.CompanyBusinessNumber);
                if (company == null)
                    return BadRequest(new { message = "Invalid company business number." });

                var user = new ApplicationUser
                {
                    UserName = model.Username,
                    Email = model.Email,
                    CompaniesId = company.CompanyId,
                    EmailConfirmed = false // Email needs to be confirmed by the company manager
                };

                var result = await _userManager.CreateAsync(user, model.Password);

                if (result.Succeeded)
                {
                    return Ok(new { message = "Worker registered successfully. Awaiting confirmation from the company manager." });
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

        [HttpPost("register-manager")]
        public async Task<IActionResult> RegisterManager([FromBody] Register model)
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

                var user = new ApplicationUser
                {
                    UserName = model.Username,
                    Email = model.Email,
                    EmailConfirmed = true // No confirmation needed for managers
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
                // Log the exception (assuming a logger is available)
                // _logger.LogError(ex, "An error occurred during login");

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
    }
}
