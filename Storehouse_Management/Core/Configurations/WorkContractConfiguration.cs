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
    public class WorkContractConfiguration : IEntityTypeConfiguration<WorkContract>
    {
        public void Configure(EntityTypeBuilder<WorkContract> builder)
        {
            builder.HasKey(c => c.WorkContractId);
            builder.Property(e => e.StartDate).IsRequired().HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.EndDate).IsRequired().HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.Salary).IsRequired();
            builder.Property(e => e.ContractFileUrl).IsRequired().HasMaxLength(255);
            builder.HasOne(e => e.ApplicationUser)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Restrict);


        }
    }
}
