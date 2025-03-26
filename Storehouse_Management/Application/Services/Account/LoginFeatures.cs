using Application.DTOs;
using Core.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace Application.Services.Account
{
    public class LoginFeatures
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly IConfiguration _configuration;
        private readonly TokenHelper _tokenHelper;
        private readonly ILogger<LoginFeatures> _logger;  // Add logger

        public LoginFeatures(UserManager<ApplicationUser> userManager, RoleManager<IdentityRole> roleManager, IConfiguration configuration, TokenHelper tokenHelper, ILogger<LoginFeatures> logger)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _configuration = configuration;
            _tokenHelper = tokenHelper;
            _logger = logger; // Inject logger
        }

        public async Task<LoginResultDTO> AuthenticateUser(Login loginDTO)
        {
            try
            {
                var user = await _userManager.FindByNameAsync(loginDTO.Username);

                if (user == null)
                {
                    return LoginResultDTO.Failure("User not found");
                }

                if (!await _userManager.CheckPasswordAsync(user, loginDTO.Password))
                {
                    return LoginResultDTO.Failure("Password incorrect.");
                }

                var token = await _tokenHelper.GenerateTokenAsync(user); // Await the token generation
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogError("Token generation failed for user: {Username}", user.UserName);
                    return LoginResultDTO.Failure("Token generation failed.");
                }


                var refreshToken = _tokenHelper.GenerateRefreshToken();
                _tokenHelper.SetRefreshToken(user, refreshToken);

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