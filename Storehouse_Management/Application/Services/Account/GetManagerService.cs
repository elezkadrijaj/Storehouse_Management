using Application.Interfaces;
using Core.Entities;
using Microsoft.AspNetCore.Identity;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.Services.Account
{
    public class GetManagerService : IGetManagerService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private const string CompanyManagerRoleName = "CompanyManager";

        public GetManagerService(UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager ?? throw new ArgumentNullException(nameof(userManager));
        }

        public async Task<IList<ApplicationUser>> GetCompanyManagersAsync()
        {
            // This is the most straightforward way using ASP.NET Core Identity
            var usersInRole = await _userManager.GetUsersInRoleAsync(CompanyManagerRoleName);
            return usersInRole;
        }

        public async Task<ApplicationUser?> GetFirstCompanyManagerAsync()
        {
            var usersInRole = await _userManager.GetUsersInRoleAsync(CompanyManagerRoleName);
            return usersInRole.FirstOrDefault();
        }
    }
}
