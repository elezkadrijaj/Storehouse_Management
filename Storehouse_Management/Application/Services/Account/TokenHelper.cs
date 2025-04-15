using Application.DTOs;
using Core.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;


namespace Application.Services.Account
{
    public class TokenHelper
    {
        private readonly IConfiguration _configuration;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<TokenHelper> _logger;

        public TokenHelper(IConfiguration configuration,
                           UserManager<ApplicationUser> userManager,
                           IHttpContextAccessor httpContextAccessor,
                           ILogger<TokenHelper> logger)
        {
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _userManager = userManager ?? throw new ArgumentNullException(nameof(userManager));
            _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }
        public async Task<string> GenerateAccessTokenAsync(ApplicationUser user)
        {
            ArgumentNullException.ThrowIfNull(user);

            if (string.IsNullOrEmpty(user.Id))
            {
                throw new ArgumentNullException(nameof(user.Id), "User ID cannot be null or empty when generating a token.");
            }
            if (string.IsNullOrEmpty(user.UserName)) 
            {
                _logger.LogWarning("Generating token for user {UserId} with null or empty UserName.", user.Id);
            }

            var jwtKey = _configuration["Jwt:Key"];
            var jwtIssuer = _configuration["Jwt:Issuer"];
            var jwtAudience = _configuration["Jwt:Audience"]; 
            var expiryMinutesConfig = _configuration["Jwt:ExpiryMinutes"] ?? "15";

            if (string.IsNullOrEmpty(jwtKey) || string.IsNullOrEmpty(jwtIssuer))
            {
                _logger.LogError("JWT Key or Issuer is not configured in appsettings. Cannot generate token.");
                throw new InvalidOperationException("JWT Key or Issuer configuration is missing.");
            }
            if (!double.TryParse(expiryMinutesConfig, out double expiryMinutes))
            {
                _logger.LogWarning("Invalid JWT ExpiryMinutes configuration '{ConfigValue}'. Defaulting to 15 minutes.", expiryMinutesConfig);
               
            }

            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var userRoles = await _userManager.GetRolesAsync(user);
            var displayName = user.UserName ?? $"User_{user.Id.Substring(0, 5)}"; 

            var authClaims = new List<Claim>
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id),
                    new Claim(ClaimTypes.Name, user.UserName ?? ""), 
                    new Claim(JwtRegisteredClaimNames.Sub, user.Id),
                    new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()), 
                    new Claim(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
                };

            authClaims.AddRange(userRoles.Select(role => new Claim(ClaimTypes.Role, role)));

            
            if (!string.IsNullOrEmpty(user.CompanyBusinessNumber))
                authClaims.Add(new Claim("CompanyBusinessNumber", user.CompanyBusinessNumber));
            if (user.CompaniesId.HasValue)
                authClaims.Add(new Claim("CompaniesId", user.CompaniesId.Value.ToString()));
            if (!string.IsNullOrEmpty(user.StorehouseName))
                authClaims.Add(new Claim("StorehouseName", user.StorehouseName));
            if (user.StorehouseId.HasValue)
                authClaims.Add(new Claim("StorehouseId", user.StorehouseId.Value.ToString()));

            _logger.LogDebug(">>> Claims being added to token for User ID {UserId}:", user.Id);
            foreach (var claim in authClaims)
            {
                _logger.LogDebug("    Claim Type: {ClaimType}, Value: {ClaimValue}", claim.Type, claim.Value);
            }

            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience, 
                expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
                claims: authClaims,
                signingCredentials: credentials);

            var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

            _logger.LogInformation("Generated Access Token for user {UserId} (Name: {UserName}) expiring at {ExpiryDateUtc}", user.Id, displayName, token.ValidTo);
            return tokenString;
        }


        public RefreshToken GenerateRefreshToken()
        {
            var refreshToken = new RefreshToken
            {
                Token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)),
                Expired = DateTime.UtcNow.AddDays(7),
                Created = DateTime.UtcNow
            };
            _logger.LogDebug("Generated new refresh token expiring at {ExpiryDateUtc}", refreshToken.Expired);
            return refreshToken;
        }
        public void SetRefreshToken(ApplicationUser user, RefreshToken newRefreshToken)
        {
            // --- Input Validation ---
            ArgumentNullException.ThrowIfNull(user);
            ArgumentNullException.ThrowIfNull(newRefreshToken);
            ArgumentException.ThrowIfNullOrEmpty(newRefreshToken.Token, nameof(newRefreshToken.Token));

            // --- Cookie Setup ---
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Expires = newRefreshToken.Expired.ToUniversalTime(),
                Secure = true, 
                SameSite = SameSiteMode.Strict 
            };

            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext != null)
            {
                httpContext.Response.Cookies.Append("refreshToken", newRefreshToken.Token, cookieOptions);
                _logger.LogInformation("Set HttpOnly refresh token cookie for user {UserId}, expiring {ExpiryDateUtc}", user.Id, cookieOptions.Expires);
            }
            else
            {
                _logger.LogWarning("HttpContext was null when trying to set refresh token cookie for user {UserId}. Cookie not set.", user.Id ?? "N/A");
            }

            user.RefreshToken = newRefreshToken.Token;
            user.TokenCreated = newRefreshToken.Created.ToUniversalTime();
            user.TokenExpires = newRefreshToken.Expired.ToUniversalTime();

            _logger.LogInformation("Updated user entity (in memory) with refresh token details for user {UserId}. Expiry: {ExpiryDateUtc}. CALLER MUST SAVE CHANGES.", user.Id, user.TokenExpires);
        }

        public string? GetUserIdFromToken(string token)
        {
            if (string.IsNullOrEmpty(token))
            {
                _logger.LogTrace("GetUserIdFromToken called with null or empty token.");
                return null;
            }

            var jwtKey = _configuration["Jwt:Key"];
            var jwtIssuer = _configuration["Jwt:Issuer"];
            var jwtAudience = _configuration["Jwt:Audience"]; 

            if (string.IsNullOrEmpty(jwtKey) || string.IsNullOrEmpty(jwtIssuer))
            {
                _logger.LogError("JWT Key or Issuer not configured. Cannot validate token in GetUserIdFromToken.");
                return null; 
            }

            var tokenHandler = new JwtSecurityTokenHandler();
            try
            {
                var validationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true, 
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),

                    ValidateIssuer = true,
                    ValidIssuer = jwtIssuer,

                    ValidateAudience = !string.IsNullOrEmpty(jwtAudience), 
                    ValidAudience = jwtAudience,

                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30) 
                };

                var principal = tokenHandler.ValidateToken(token, validationParameters, out SecurityToken validatedToken);

                var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier);

                if (userIdClaim == null || string.IsNullOrEmpty(userIdClaim.Value))
                {
                    _logger.LogWarning("Validated token is MISSING the required User ID claim ('{ClaimType}') or the claim value is empty.", ClaimTypes.NameIdentifier);
                    return null;
                }

                _logger.LogInformation("Token validated successfully via GetUserIdFromToken for User ID: {UserId}", userIdClaim.Value);
                return userIdClaim.Value;
            }
            catch (SecurityTokenExpiredException ex)
            {
                _logger.LogWarning("Token validation failed in GetUserIdFromToken: Token expired at {ExpiryTime}. Details: {ExceptionMessage}", ex.Expires.ToUniversalTime(), ex.Message);
                return null;
            }
            catch (SecurityTokenInvalidSignatureException ex)
            {
                _logger.LogWarning(ex, "Token validation failed in GetUserIdFromToken: Invalid signature.");
                return null;
            }
            catch (Exception ex) when (ex is SecurityTokenException || ex is ArgumentException)
            {

                _logger.LogWarning(ex, "Token validation failed in GetUserIdFromToken: {ValidationExceptionMessage}", ex.Message);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An UNEXPECTED error occurred during token validation in GetUserIdFromToken.");
                return null;
            }
        }
    }

}