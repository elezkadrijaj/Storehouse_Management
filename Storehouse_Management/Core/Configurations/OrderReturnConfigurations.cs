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
            builder.HasOne(e => e.Orders)
                .WithMany()
                .HasForeignKey(e => e.OrderId);
        }
    }
}
