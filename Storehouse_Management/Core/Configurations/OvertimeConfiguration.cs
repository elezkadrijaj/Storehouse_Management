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
    public class OvertimeConfiguration : IEntityTypeConfiguration<Overtime>
    {
        public void Configure(EntityTypeBuilder<Overtime> builder)
        {
            builder.HasKey(c => c.OvertimeId);
            builder.Property(e => e.Date).IsRequired().HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.HoursWorked).IsRequired();
            builder.HasOne(e => e.ApplicationUser)
               .WithMany()
               .HasForeignKey(e => e.UserId)
             .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
