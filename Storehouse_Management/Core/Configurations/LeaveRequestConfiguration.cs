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
    public class LeaveRequestConfiguration : IEntityTypeConfiguration<LeaveRequest>
    {
        public void Configure(EntityTypeBuilder<LeaveRequest> builder)
        {
            builder.HasKey(c => c.LeaveRequestId);
            builder.Property(e => e.StartDate).IsRequired().HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.EndDate).IsRequired().HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.Description).IsRequired().HasMaxLength(255);

            builder.HasOne(e => e.ApplicationUser)
                .WithMany() // Consider using a collection navigation property here if a User can have multiple LeaveRequests.  See note below.
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Restrict); // Important: Prevent cascading deletes

            builder.HasOne(e => e.ApplicationUser) // Use the Manager navigation property
                .WithMany() // Consider using a collection navigation property here if a User can manage multiple LeaveRequests. See note below.
                .HasForeignKey(e => e.ManagerId)
                .OnDelete(DeleteBehavior.Restrict); // Important: Prevent cascading deletes
        }
    }
}
