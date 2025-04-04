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
    public class OrderStatusHistoryConfiguration : IEntityTypeConfiguration<OrderStatusHistory>
    {
        public void Configure(EntityTypeBuilder<OrderStatusHistory> builder)
        {
            builder.HasKey(c => c.OrderStatusHistoryId);
            builder.Property(e => e.UpdatedByUserId).IsRequired().HasMaxLength(255);
            builder.Property(e => e.Status).IsRequired().HasMaxLength(255);
            builder.Property(e => e.Timestamp).IsRequired().HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.Description).IsRequired().HasMaxLength(255);

            builder.HasOne(e => e.Orders)
                .WithMany(o => o.OrderStatusHistories)
                .HasForeignKey(e => e.OrdersId)
                .IsRequired();
        }
    }
}
