using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Configurations
{
    public class OrderAssignmentConfiguration : IEntityTypeConfiguration<OrderAssignment>
    {
        public void Configure(EntityTypeBuilder<OrderAssignment> builder)
        {
            builder.HasKey(oa => new { oa.OrderId, oa.WorkerId });

            builder.HasOne(oa => oa.Order)
                .WithMany(o => o.OrderAssignments)
                .HasForeignKey(oa => oa.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(oa => oa.Worker)
                .WithMany()
                .HasForeignKey(oa => oa.WorkerId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
