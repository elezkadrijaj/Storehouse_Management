using Core.Entities;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Configurations
{
    public class OrderConfiguration : IEntityTypeConfiguration<Order>
    {
        public void Configure(EntityTypeBuilder<Order> builder)
        {
            builder.HasKey(c => c.OrderId);
            builder.Property(e => e.Status).IsRequired().HasMaxLength(255);
            builder.Property(e => e.Created).IsRequired().HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.TotalPrice).IsRequired();

            builder.Property(o => o.ClientName).HasMaxLength(200);

            builder.Property(o => o.ClientPhoneNumber).HasMaxLength(30);

            builder.Property(o => o.ShippingAddressStreet).HasMaxLength(255);

            builder.Property(o => o.ShippingAddressCity).HasMaxLength(100);

            builder.Property(o => o.ShippingAddressPostalCode).HasMaxLength(20);

            builder.Property(o => o.ShippingAddressCountry).HasMaxLength(100);

            builder.HasOne(e => e.AppUsers)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .IsRequired(false);

            builder.HasMany(e => e.OrderItems)
                .WithOne(oi => oi.Orders)
                .HasForeignKey(oi => oi.OrdersId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
