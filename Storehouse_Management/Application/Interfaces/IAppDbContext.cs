using Core.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.Interfaces
{
    public interface IAppDbContext
    {
        public DbSet<ApplicationUser> Users { get; set; }
        public DbSet<Company> Companies { get; set; }
        public DbSet<Storehouse> Storehouses { get; set; }
        public DbSet<Section> Sections { get; set; }
        public DbSet<LeaveRequest> LeaveRequest { get; set; }
        public DbSet<Overtime> Overtimes { get; set; }
        public DbSet<WorkContract> WorkContract { get; set; }
        public DbSet<Schedule> Schedule { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderItem> OrderItems { get; set; }
        public DbSet<OrderStatusHistory> OrderStatusHistorys { get; set; }
        public DbSet<OrderReturn> OrderReturns { get; set; }

        Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}
