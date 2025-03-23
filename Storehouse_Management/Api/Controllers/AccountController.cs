using Application.DTOs;
using Application.Services.Account;
using Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

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

        public AccountController(UserManager<ApplicationUser> userManager, RoleManager<IdentityRole> roleManager, IConfiguration configuration, LoginFeatures loginFeature)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _configuration = configuration;
            _loginFeature = loginFeature;
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
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] Register model)
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
                    Email = model.Email
                };

                var result = await _userManager.CreateAsync(user, model.Password);

                if (result.Succeeded)
                {
                    return Ok(new { message = "User registered successfully" });
                }

                return BadRequest(result.Errors);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
                Console.WriteLine($"Inner Exception: {ex.InnerException?.Message}");
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "An error occurred during registration",
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
    }
}
