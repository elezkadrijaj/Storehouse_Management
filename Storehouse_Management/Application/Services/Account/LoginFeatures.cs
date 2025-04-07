// Application/Services/Account/LoginFeatures.cs
using Application.DTOs;
using Core.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Application.Interfaces; // Import IStorehouseRepository

namespace Application.Services.Account
{
    public class LoginFeatures
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly IConfiguration _configuration;
        private readonly TokenHelper _tokenHelper;
        private readonly ILogger<LoginFeatures> _logger;
        private readonly IStorehouseRepository _storehouseRepository; // Inject the interface

        public LoginFeatures(UserManager<ApplicationUser> userManager,
                             RoleManager<IdentityRole> roleManager,
                             IConfiguration configuration,
                             TokenHelper tokenHelper,
                             ILogger<LoginFeatures> logger,
                             IStorehouseRepository storehouseRepository) // Inject the interface
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _configuration = configuration;
            _tokenHelper = tokenHelper;
            _logger = logger;
            _storehouseRepository = storehouseRepository;
        }

        public async Task<LoginResultDTO> AuthenticateUser(Login loginDTO)
        {
            try
            {
                var user = await _userManager.FindByNameAsync(loginDTO.Username);

                if (user == null)
                {
                    _logger.LogWarning("Authentication failed: User not found - {Username}", loginDTO.Username);
                    return LoginResultDTO.Failure("User not found");
                }

                if (!await _userManager.CheckPasswordAsync(user, loginDTO.Password))
                {
                    _logger.LogWarning("Authentication failed: Incorrect password for user - {Username}", loginDTO.Username);
                    return LoginResultDTO.Failure("Password incorrect.");
                }

                // **CRUCIAL: Populate StorehouseName BEFORE generating the token!**
                if (user.StorehouseId.HasValue)
                {
                    var storehouse = await _storehouseRepository.GetStorehouseByIdAsync(user.StorehouseId.Value);
                    if (storehouse != null)
                    {
                        user.StorehouseName = storehouse.StorehouseName;
                        _logger.LogInformation("StorehouseName populated for user {Username}: {StorehouseName}", user.UserName, user.StorehouseName);
                    }
                    else
                    {
                        _logger.LogWarning("Storehouse not found for user {Username} with StorehouseId {StorehouseId}", user.UserName, user.StorehouseId.Value);
                    }
                }
                else
                {
                    _logger.LogInformation("User {Username} is not assigned to a storehouse.", user.UserName);
                }

                var token = await _tokenHelper.GenerateTokenAsync(user); // Await the token generation
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogError("Token generation failed for user: {Username}", user.UserName);
                    return LoginResultDTO.Failure("Token generation failed.");
                }

                var refreshToken = _tokenHelper.GenerateRefreshToken();
                _tokenHelper.SetRefreshToken(user, refreshToken);

                _logger.LogInformation("User {Username} successfully authenticated.", user.UserName);
                return LoginResultDTO.Success(token); // Pass the already generated token
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred during authentication for user: {Username}", loginDTO.Username);
                return LoginResultDTO.Failure("Authentication failed due to an error."); //Generic error for the client
            }
        }
    }
}