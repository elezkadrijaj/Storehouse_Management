using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Core.Configurations;

namespace Infrastructure.Data
{
    public class AppDbContext : IdentityDbContext<ApplicationUser>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Company> Companies { get; set; }
        public DbSet<Storehouse> Storehouses { get; set; }
        public DbSet<Section> Sections { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderItem> OrderItems { get; set; }

        public DbSet<OrderStatusHistory> OrderStatusHistorys { get; set; }
        public DbSet<OrderReturn> OrderReturns { get; set; }


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

        }
    }
}
