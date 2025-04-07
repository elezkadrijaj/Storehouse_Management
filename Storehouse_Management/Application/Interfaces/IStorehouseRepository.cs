using Core.Entities;

namespace Application.Interfaces
{
    public interface IStorehouseRepository
    {
        Task<Storehouse?> GetStorehouseByIdAsync(int id);
        Task<Storehouse?> GetStorehouseByNameAndCompanyIdAsync(string storehouseName, int companyId);
    }
}
