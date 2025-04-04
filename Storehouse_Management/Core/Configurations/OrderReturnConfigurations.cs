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
    public class OrderReturnConfigurations : IEntityTypeConfiguration<OrderReturn>
    {
        public void Configure(EntityTypeBuilder<OrderReturn> builder)
        {
            builder.HasKey(c => c.OrderReturnId);
            builder.Property(e => e.Reason).IsRequired().HasMaxLength(255);
            builder.Property(e => e.Status).IsRequired().HasMaxLength(255);

            builder.HasOne(e => e.Orders)
                .WithMany()
                .HasForeignKey(e => e.OrderId);
        }
    }
}
