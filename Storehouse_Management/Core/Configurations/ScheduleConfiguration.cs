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
    public class ScheduleConfiguration : IEntityTypeConfiguration<Schedule>
    {
        public void Configure(EntityTypeBuilder<Schedule> builder)
        {
            builder.HasKey(c => c.ScheduleId);
            builder.Property(e => e.StartDate).IsRequired().HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.EndDate).IsRequired().HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.BreakTime).IsRequired().HasDefaultValueSql("GETDATE()");
            builder.HasOne(e => e.ApplicationUser)
               .WithMany()
               .HasForeignKey(e => e.UserId)
               .OnDelete(DeleteBehavior.Restrict);

        }
    }
}
