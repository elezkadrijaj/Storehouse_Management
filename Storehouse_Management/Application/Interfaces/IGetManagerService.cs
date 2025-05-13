using Core.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.Interfaces
{
    public interface IGetManagerService
    {
        Task<IList<ApplicationUser>> GetCompanyManagersAsync();
        Task<ApplicationUser?> GetFirstCompanyManagerAsync();
    }
}
