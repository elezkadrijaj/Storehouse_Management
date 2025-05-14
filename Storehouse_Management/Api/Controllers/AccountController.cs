using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Runtime.Intrinsics.X86;
using System.Security.Claims;
using Application.DTOs;
using Application.Services.Account;
using Core.Entities;
using DnsClient.Internal;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AccountController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly ILogger<AccountController> _logger;
        private readonly LoginFeatures _loginFeature;
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _context;


        public AccountController(UserManager<ApplicationUser> userManager, RoleManager<IdentityRole> roleManager, IConfiguration configuration, LoginFeatures loginFeature, AppDbContext context, ILogger<AccountController> logger)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _configuration = configuration;
            _loginFeature = loginFeature;
            _context = context;
            _logger = logger;
        }

        [HttpPost("register-company-manager")]
        [AllowAnonymous]
        public async Task<IActionResult> RegisterCompanyManager([FromBody] RegisterCompanyManagerDto model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // 1. Check if user already exists (same as before)
            var existingUserByEmail = await _userManager.FindByEmailAsync(model.Email);
            if (existingUserByEmail != null)
            {
                return BadRequest(new { message = "Email is already registered." });
            }
            var existingUserByName = await _userManager.FindByNameAsync(model.Username);
            if (existingUserByName != null)
            {
                return BadRequest(new { message = "Username is already taken." });
            }

            // 2. Check company (same as before, but now we also have a company name from the user)
            var existingCompany = await _context.Companies
                                        .FirstOrDefaultAsync(c => c.Numer_Biznesit == model.CompanyBusinessNumber);

            if (existingCompany != null)
            {
                // Add your logic for handling pre-existing companies.
                // For instance, if the name differs, is it an update or a conflict?
                // For simplicity, we'll still consider it a potential conflict if actively managed.
                var existingManagerForCompany = await _userManager.Users
                    .AnyAsync(u => u.CompanyBusinessNumber == model.CompanyBusinessNumber /* && u has CompanyManager role */);

                if (existingManagerForCompany)
                {
                    return BadRequest(new { message = "This company business number is already registered with a manager." });
                }
                // If existingCompany is just a stub and the new model.CompanyName is provided,
                // you might decide to update the existingCompany's name here.
                // Or, if the names are different, treat it as an error or a more complex "claim" process.
            }

            ApplicationUser user = null;
            Company companyToProcess = existingCompany;

            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // 3. Create or find/update the Company
                    if (companyToProcess == null)
                    {
                        companyToProcess = new Company
                        {
                            Numer_Biznesit = model.CompanyBusinessNumber,
                            Name = model.CompanyName,
                            Email = model.Email,
                            Phone_Number = string.Empty, // Provide empty string
                            Address = string.Empty,      // Provide empty string
                            Industry = string.Empty,     // Provide empty string
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        _context.Companies.Add(companyToProcess);
                        await _context.SaveChangesAsync();
                    }
                    else
                    {
                        // Company with this business number already exists.
                        // You might want to update its name if it was a placeholder and now a proper name is provided.
                        // This depends on your business rules.
                        if (string.IsNullOrWhiteSpace(companyToProcess.Name) || companyToProcess.Name.StartsWith("Company for")) // Example placeholder check
                        {
                            companyToProcess.Name = model.CompanyName;
                            companyToProcess.UpdatedAt = DateTime.UtcNow;
                            // Also update company email if it was a placeholder
                            if (string.IsNullOrWhiteSpace(companyToProcess.Email) || companyToProcess.Email != model.Email)
                            {
                                companyToProcess.Email = model.Email;
                            }
                            _context.Companies.Update(companyToProcess); // Mark as modified
                            await _context.SaveChangesAsync();
                        }
                        // If names differ significantly and it's not a placeholder, you might have a conflict.
                        // else if (companyToProcess.Name != model.CompanyName) { /* handle conflict */ }
                    }

                    // 4. Create the ApplicationUser (CompanyManager) (same as before)
                    user = new ApplicationUser
                    {
                        UserName = model.Username,
                        Email = model.Email,
                        CompaniesId = companyToProcess.CompanyId,
                        CompanyBusinessNumber = model.CompanyBusinessNumber,
                        EmailConfirmed = false
                    };

                    var result = await _userManager.CreateAsync(user, model.Password);
                    if (!result.Succeeded)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "User registration failed.", errors = result.Errors });
                    }

                    // 5. Assign "CompanyManager" role (same as before)
                    if (!await _roleManager.RoleExistsAsync("CompanyManager"))
                    {
                        await _roleManager.CreateAsync(new IdentityRole("CompanyManager"));
                    }
                    await _userManager.AddToRoleAsync(user, "CompanyManager");

                    await transaction.CommitAsync();
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    // Log ex
                    return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred during registration.", error = ex.Message });
                }
            }

            return Ok(new { message = "Company manager registered successfully. Please complete your company profile if needed.", userId = user.Id, companyId = companyToProcess.CompanyId });
        }

        [HttpGet("contacts")]
        [Authorize]// Route: GET /api/users/contacts
        public async Task<IActionResult> GetAllContacts()
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
                        user.UserName
                    });
                }

                return Ok(userDtos);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred while fetching users", error = ex.Message });
            }
        }


        [HttpGet("me/{id}")]
        [Authorize]
        public async Task<ActionResult<UserProfileDto>> GetMyProfile(string id)
        {
            _logger.LogInformation("Attempting GetMyProfile for user with ID: {UserId}", id);

            if (string.IsNullOrEmpty(id))
            {
                _logger.LogWarning("User ID parameter is missing.");
                return BadRequest(new { message = "User ID is required." });
            }

            try
            {
                // Fetch the user by ID directly from the database
                var user = await _userManager.FindByIdAsync(id);

                if (user == null)
                {
                    _logger.LogWarning("User with ID {UserId} not found.", id);
                    return NotFound(new { message = "User not found." });
                }

                // Get the roles assigned to the user
                var roles = await _userManager.GetRolesAsync(user);
                _logger.LogInformation("Roles found for user {UserId}: {Roles}", user.Id, string.Join(", ", roles));

                // Fetch company name if necessary
                string companyName = null;
                if (user.CompaniesId.HasValue)
                {
                    var company = await _context.Companies.FindAsync(user.CompaniesId.Value);
                    companyName = company?.Name;
                }

                // Build the user profile DTO
                var userProfile = new UserProfileDto
                {
                    Id = user.Id,
                    Username = user.UserName,
                    Email = user.Email,
                    Roles = roles,
                    CompaniesId = user.CompaniesId,
                    CompanyName = companyName,
                    CompanyBusinessNumber = user.CompanyBusinessNumber,
                    StorehouseId = user.StorehouseId,
                    StorehouseName = user.StorehouseName,
                    EmailConfirmed = user.EmailConfirmed
                };

                return Ok(userProfile);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while fetching user profile for User ID: {UserId}", id);
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred while fetching user profile.", error = ex.Message });
            }
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

                var company = await _context.Companies
                    .FirstOrDefaultAsync(c => c.Numer_Biznesit == model.CompanyBusinessNumber);
                if (company == null)
                    return BadRequest(new { message = "Invalid company business number." });

                var storehouse = await _context.Storehouses
                    .FirstOrDefaultAsync(s => s.StorehouseName == model.StorehouseName && s.CompaniesId == company.CompanyId);
                if (storehouse == null)
                    return BadRequest(new { message = "Invalid storehouse name for the provided company." });

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
                {
                    return BadRequest(result.Errors);
                }

                return Ok(new { message = "Worker account created successfully. Awaiting email confirmation and role assignment from the company manager." });
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

                if (user.EmailConfirmed)
                {
                    return BadRequest(new { message = "Worker email is already confirmed." });
                }

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

                var user = await _userManager.FindByNameAsync(loginDTO.Username);
                if (user != null && !user.EmailConfirmed)
                {
                    bool isManager = await _userManager.IsInRoleAsync(user, "CompanyManager");
                    if (!isManager) 
                    {
                        return Unauthorized(new { message = "Email not confirmed. Please contact your manager." });
                    }
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
        [Authorize(Policy = "CompanyManagerPolicy")]
        public async Task<IActionResult> AddRole([FromBody] string role)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(role))
                {
                    return BadRequest("Role name cannot be empty.");
                }

                role = role.Trim();

                if (!await _roleManager.RoleExistsAsync(role))
                {
                    var result = await _roleManager.CreateAsync(new IdentityRole(role));
                    if (result.Succeeded)
                    {
                        return Ok(new { message = $"Role '{role}' added successfully" });
                    }

                    return BadRequest(result.Errors);
                }

                return BadRequest($"Role '{role}' already exists");
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

        [HttpPut("update-role")] // Using HttpPut for updates
        [Authorize(Roles = "CompanyManager")]
        public async Task<IActionResult> UpdateRole([FromBody] AssignRoleDto model) // Can reuse AssignRoleDto
        {
            try
            {
                var user = await _userManager.FindByNameAsync(model.Username);
                if (user == null)
                {
                    return NotFound(new { message = "User not found." });
                }

                // Optional: Check if the new role is valid/exists
                if (!await _roleManager.RoleExistsAsync(model.Role))
                {
                    return BadRequest(new { message = $"Role '{model.Role}' does not exist. Cannot update." });
                }

                var currentRoles = await _userManager.GetRolesAsync(user);

                // If the user already has only this role, no need to do anything
                if (currentRoles.Count == 1 && currentRoles.Contains(model.Role))
                {
                    return Ok(new { message = "User already has this role. No update performed." });
                }

                // Remove all current roles
                var removeResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);
                if (!removeResult.Succeeded)
                {
                    // Log errors
                    return BadRequest(new { message = "Failed to remove existing roles before update.", errors = removeResult.Errors });
                }

                // Add the new role
                var addResult = await _userManager.AddToRoleAsync(user, model.Role);
                if (addResult.Succeeded)
                {
                    return Ok(new { message = "User role updated successfully." });
                }

                // Log errors
                // If adding the new role fails after removing old ones, this is problematic.
                // You might consider a transaction or a way to roll back, though for roles it's often acceptable.
                return BadRequest(new { message = "Failed to add the new role during update.", errors = addResult.Errors });
            }
            catch (Exception ex)
            {
                // Log error
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred while updating the role.", error = ex.Message });
            }
        }

        [HttpGet("assignable-roles")]
        [Authorize(Roles = "CompanyManager")]
        public async Task<IActionResult> GetAssignableRoles()
        {
            try
            {
                var allRoleNames = await _roleManager.Roles
                                            .Select(r => r.Name)
                                            .ToListAsync();

                if (allRoleNames == null || !allRoleNames.Any())
                {
                    return Ok(new List<string>());
                }
                var assignableRoles = allRoleNames
                                        .Where(roleName => !string.IsNullOrEmpty(roleName))
                                        .ToList();

                if (!assignableRoles.Any())
                {
                    return NotFound(new { message = "No roles available for assignment by a Company Manager." });
                }

                return Ok(assignableRoles);
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An error occurred while fetching assignable roles", error = ex.Message });
            }
        }
        [HttpGet("manager-by-business-number/{businessNumber}")]
        [Authorize(Roles = "Admin, CompanyManager")]
        public async Task<IActionResult> GetCompanyManagerByBusinessNumber(string businessNumber)
        {
            try
            {
                if (string.IsNullOrEmpty(businessNumber))
                {
                    return BadRequest("Business number cannot be empty.");
                }

                var requestingUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var requestingUser = await _userManager.FindByIdAsync(requestingUserId);
                if (requestingUser == null) return Unauthorized();

                bool isAdmin = await _userManager.IsInRoleAsync(requestingUser, "Admin");
                if (!isAdmin && requestingUser.CompanyBusinessNumber != businessNumber)
                {
                    return Forbid("You can only view managers for your own company.");
                }

                var potentialManagers = await _userManager.Users
                   .Where(u => u.CompanyBusinessNumber == businessNumber)
                   .ToListAsync();

                if (!potentialManagers.Any())
                {
                    return NotFound($"No users found for business number {businessNumber}.");
                }

                ApplicationUser manager = null;
                foreach (var user in potentialManagers)
                {
                    if (await _userManager.IsInRoleAsync(user, "CompanyManager"))
                    {
                        manager = user;
                        break; 
                    }
                }

                if (manager == null)
                {
                    return NotFound($"Company manager role not found for business number {businessNumber}.");
                }


                var managerDto = new CompanyManagerDto
                {
                    Id = manager.Id,
                    Username = manager.UserName,
                    Email = manager.Email,
                    CompanyBusinessNumber = manager.CompanyBusinessNumber,
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

                var allUsers = await _userManager.Users
                    .Include(u => u.Companies)
                    .Where(u => u.CompanyBusinessNumber == businessNumber)
                    .ToListAsync(); ;

                var workers = allUsers.Where(u => !_userManager.IsInRoleAsync(u, "CompanyManager").Result).ToList();

                if (workers == null || !workers.Any())
                {
                    return NotFound("No workers found for the specified business number.");
                }

                var workerDtos = new List<WorkerDto>();
                foreach (var worker in workers)
                {
                    var roles = await _userManager.GetRolesAsync(worker);

                    workerDtos.Add(new WorkerDto
                    {
                        Id = worker.Id,
                        Username = worker.UserName,
                        Email = worker.Email,
                        EmailConfirmed = worker.EmailConfirmed,
                        CompanyName = worker.Companies?.Name,
                        CompanyBusinessNumber = worker.CompanyBusinessNumber,
                        CompaniesId = worker.CompaniesId,
                        StoreHouseName = worker.StorehouseName,
                        Role = roles.FirstOrDefault()

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

