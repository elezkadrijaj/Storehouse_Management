using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using System.Text.Json;
using System.Security.Claims;

using Core.Entities;
using Infrastructure.Data;
using Infrastructure.Configurations;
using MongoDB.Driver;
using Swashbuckle.AspNetCore.Filters;

using Application.Interfaces;
using Application.Services.Account;
using Application.Services.Orders;
using Application.Services.Products;
using Application.Hubs;
using Microsoft.Extensions.FileProviders;


var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();

builder.Services.Configure<MongoDbSettings>(configuration.GetSection("MongoDbSettings"));

builder.Services.AddSingleton<IMongoClient>(provider =>
{
    var settings = provider.GetRequiredService<IOptions<MongoDbSettings>>().Value;
    ArgumentNullException.ThrowIfNull(settings?.ConnectionString, "MongoDbSettings:ConnectionString");
    return new MongoClient(settings.ConnectionString);
});

builder.Services.AddSingleton<IMongoDbSettings, MongoDbSettingsImpl>();


builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
});


builder.Services.Configure<MongoDbSettings>(configuration.GetSection("MongoDbSettings"));

builder.Services.AddSingleton<IMongoClient>(provider =>
{
    var settings = provider.GetRequiredService<IOptions<MongoDbSettings>>().Value;
    ArgumentNullException.ThrowIfNull(settings?.ConnectionString, "MongoDbSettings:ConnectionString must be configured in appsettings.json");
    return new MongoClient(settings.ConnectionString);
});

builder.Services.AddSingleton<IMongoDbSettings>(provider =>
    provider.GetRequiredService<IOptions<MongoDbSettings>>().Value);


var connectionString = configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrEmpty(connectionString))
{
    throw new InvalidOperationException("Connection string 'DefaultConnection' not found in configuration.");
}

var connectionString = configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrEmpty(connectionString)) throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString, b => b.MigrationsAssembly("Infrastructure")));

builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireDigit = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
    options.User.RequireUniqueEmail = true;
    options.SignIn.RequireConfirmedAccount = false;
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

var jwtKey = configuration["Jwt:Key"];
var jwtIssuer = configuration["Jwt:Issuer"];
var jwtAudience = configuration["Jwt:Audience"];

if (string.IsNullOrEmpty(jwtKey) || jwtKey.Length < 32) throw new InvalidOperationException("JWT Key ('Jwt:Key') is missing or too short (at least 32 chars recommended).");
if (string.IsNullOrEmpty(jwtIssuer)) throw new InvalidOperationException("JWT Issuer ('Jwt:Issuer') is missing.");

var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = !string.IsNullOrEmpty(jwtAudience),
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = securityKey,
        ClockSkew = TimeSpan.FromMinutes(1)
    };

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;

            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/chathub"))
            {
                context.Token = accessToken;
                Console.WriteLine($"---> SignalR: Token found in query string for path: {path}");
            }
            else if (string.IsNullOrEmpty(context.Token) && context.Request.Headers.ContainsKey("Authorization"))
            {
                string authHeader = context.Request.Headers["Authorization"];
                if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                {
                    context.Token = authHeader.Substring("Bearer ".Length).Trim();
                }
            }

            return Task.CompletedTask;
        },
        OnAuthenticationFailed = context =>
        {
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
            logger.LogError("JWT Authentication Failed: {ExceptionType} - {ExceptionMessage}", context.Exception?.GetType().Name, context.Exception?.Message);

            if (context.Exception is SecurityTokenExpiredException exExp) logger.LogWarning("--- JWT Reason: Token expired at {Expiry}", exExp.Expires);
            else if (context.Exception is SecurityTokenInvalidIssuerException) logger.LogWarning("--- JWT Reason: Invalid Issuer. Expected: {ExpectedIssuer}", options.TokenValidationParameters.ValidIssuer);
            else if (context.Exception is SecurityTokenInvalidAudienceException) logger.LogWarning("--- JWT Reason: Invalid Audience. Expected: {ExpectedAudience}", options.TokenValidationParameters.ValidAudience);
            else if (context.Exception is SecurityTokenInvalidSignatureException) logger.LogWarning("--- JWT Reason: Invalid Signature.");
            else if (context.Exception is SecurityTokenNoExpirationException) logger.LogWarning("--- JWT Reason: Token has no expiration ('exp' claim).");
            else if (context.Exception is SecurityTokenInvalidLifetimeException) logger.LogWarning("--- JWT Reason: Token lifetime is invalid (e.g., 'nbf' is in the future).");

            return Task.CompletedTask;
        },
        OnChallenge = context => {
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
            logger.LogWarning("JWT Challenge Triggered for path: {Path}. Status Code before handle: {StatusCode}", context.Request.Path, context.Response.StatusCode);

            context.HandleResponse();

            if (!context.Response.HasStarted)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                logger.LogInformation("--- JWT Challenge: Response set to 401.");
            }
            return Task.CompletedTask;
        },
        OnTokenValidated = context => {
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
            var userId = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            var userName = context.Principal?.FindFirstValue(ClaimTypes.Name);
            logger.LogInformation("JWT Token Validated Successfully for User: {UserName} (ID: {UserId}), Path: {Path}", userName ?? "N/A", userId ?? "N/A", context.Request.Path);
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SuperAdminPolicy", policy => policy.RequireRole("SuperAdmin"));
    options.AddPolicy("CompanyManagerPolicy", policy => policy.RequireRole("CompanyManager"));
    options.AddPolicy("StorehouseAccessPolicy", policy => policy.RequireRole("StorehouseManager", "CompanyManager", "SuperAdmin"));
    options.AddPolicy("TransporterAccessPolicy", policy => policy.RequireRole("Transporter", "CompanyManager", "SuperAdmin"));
});

builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
});

builder.Services.AddScoped<TokenHelper>();
builder.Services.AddScoped<LoginFeatures>();
builder.Services.AddScoped<ProductService>();
builder.Services.AddScoped<SupplierService>();
builder.Services.AddScoped<CategoryService>();
builder.Services.AddScoped<IOrderService, OrderService>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAppDbContext, AppDbContext>();

builder.Services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());
builder.Services.AddScoped<IStorehouseRepository, StorehouseRepository>();

builder.Services.AddSingleton<UserConnectionManager>();

builder.Services.AddSingleton<IHttpContextAccessor, HttpContextAccessor>();

var MyAllowSpecificOrigins = "_myAllowSpecificOrigins";
builder.Services.AddCors(options =>
{
    options.AddPolicy(name: MyAllowSpecificOrigins,
                      policy =>
                      {
                          policy.WithOrigins("http://localhost:5173")
                                .AllowAnyHeader()
                                .AllowAnyMethod()
                                .AllowCredentials();
                      });
});

builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Storehouse API", Version = "v1" });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: 'Bearer 12345abcdef'",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    options.OperationFilter<SecurityRequirementsOperationFilter>();
});


options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                },
                Scheme = "oauth2",
                Name = "Bearer",
                In = ParameterLocation.Header,
            },
            new List<string>()
        }
    });
});


builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy =>
        {
            policy.WithOrigins("http://localhost:5173")
                   .AllowAnyMethod()
                   .AllowAnyHeader()
                   .AllowCredentials();
        });
    options.OperationFilter<SecurityRequirementsOperationFilter>(true, "Bearer");

});

var app = builder.Build();



app.UseStaticFiles(new StaticFileOptions
{
   FileProvider = new PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "images")),
   RequestPath = "/images"
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(Directory.GetCurrentDirectory(), "images")),
    RequestPath = "/images"
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Storehouse API v1");
    });
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseCors(MyAllowSpecificOrigins);

app.UseRouting();

app.UseStaticFiles();

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.MapHub<ChatHub>("/chathub");

app.Lifetime.ApplicationStarted.Register(() => Console.WriteLine($"Application started. Listening on: {string.Join(", ", app.Urls)}"));
app.Lifetime.ApplicationStopping.Register(() => Console.WriteLine("Application stopping..."));
app.Lifetime.ApplicationStopped.Register(() => Console.WriteLine("Application stopped."));


app.Run();