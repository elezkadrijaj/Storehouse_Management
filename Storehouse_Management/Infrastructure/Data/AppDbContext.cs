using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Core.Configurations;
using Application.Interfaces;

namespace Infrastructure.Data
{
    public class AppDbContext : IdentityDbContext<ApplicationUser>, IAppDbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

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
        public DbSet<OrderAssignment> OrderAssignments { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.ApplyConfiguration(new CompanyConfigurations());

            builder.ApplyConfiguration(new ApplicationUserConfigurations());

            builder.ApplyConfiguration(new ApplicationUserConfigurations());

            builder.ApplyConfiguration(new SectionConfiguration());

            builder.ApplyConfiguration(new OrderConfiguration());

            builder.ApplyConfiguration(new OrderItemConfiguration());

            builder.ApplyConfiguration(new OrderStatusHistoryConfiguration());

            builder.ApplyConfiguration(new OrderReturnConfigurations());

            builder.ApplyConfiguration(new LeaveRequestConfiguration());

            builder.ApplyConfiguration(new OvertimeConfiguration());

            builder.ApplyConfiguration(new WorkContractConfiguration());

            builder.ApplyConfiguration(new ScheduleConfiguration());

            builder.ApplyConfiguration(new OrderAssignmentConfiguration());
        }
    }
}
