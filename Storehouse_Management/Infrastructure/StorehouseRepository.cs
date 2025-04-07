// Infrastructure/Data/StorehouseRepository.cs
using Application.Interfaces;
using Core.Entities;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace Infrastructure.Data
{
    public class StorehouseRepository : IStorehouseRepository
    {
        private readonly AppDbContext _context;

        public StorehouseRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Storehouse?> GetStorehouseByIdAsync(int id)
        {
            return await _context.Storehouses.FindAsync(id);
        }

        public async Task<Storehouse?> GetStorehouseByNameAndCompanyIdAsync(string storehouseName, int companyId)
        {
            return await _context.Storehouses
                .FirstOrDefaultAsync(s => s.StorehouseName == storehouseName && s.CompaniesId == companyId);
        }
    }
}