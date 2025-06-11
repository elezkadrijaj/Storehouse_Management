using Application.DTOs;
using Core.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace Application.Services.Account
{
    public class TokenHelper
    {
        private readonly IConfiguration _configuration;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<TokenHelper> _logger;

        public TokenHelper(
            IConfiguration configuration,
            UserManager<ApplicationUser> userManager,
            IHttpContextAccessor httpContextAccessor,
            ILogger<TokenHelper> logger)
        {
            _configuration = configuration;
            _userManager = userManager;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
        }

        public async Task<string> GenerateTokenAsync(ApplicationUser user)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var userRoles = await _userManager.GetRolesAsync(user);

            var authClaims = new List<Claim>
            {
                // Standard Claims
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Name, user.UserName!),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),

                // --- THIS IS THE FIX: Changed claim names to PascalCase ---
                new Claim("CompaniesId", user.CompaniesId?.ToString() ?? string.Empty),
                new Claim("CompanyBusinessNumber", user.CompanyBusinessNumber ?? string.Empty)
            };

            // Add role claims
            authClaims.AddRange(userRoles.Select(role => new Claim(ClaimTypes.Role, role)));

            // Add other optional claims
            if (!string.IsNullOrEmpty(user.StorehouseName))
            {
                // Standardized to PascalCase as well
                authClaims.Add(new Claim("StorehouseName", user.StorehouseName));
            }

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                expires: DateTime.Now.AddMinutes(double.Parse(_configuration["Jwt:ExpiryMinutes"]!)),
                claims: authClaims,
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public RefreshToken GenerateRefreshToken()
        {
            var refreshToken = new RefreshToken
            {
                Token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)),
                Expired = DateTime.Now.AddDays(7)
            };
            return refreshToken;
        }

        public void SetRefreshToken(ApplicationUser user, RefreshToken newRefreshToken)
        {
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Expires = newRefreshToken.Expired,
            };
            _httpContextAccessor.HttpContext?.Response.Cookies.Append("refreshToken", newRefreshToken.Token, cookieOptions);
            user.RefreshToken = newRefreshToken.Token;
            user.TokenCreated = newRefreshToken.Created;
            user.TokenExpires = newRefreshToken.Expired;
        }
    }
}