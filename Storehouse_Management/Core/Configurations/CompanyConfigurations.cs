using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Core.Entities;

namespace Core.Configurations
{
    public class CompanyConfigurations : IEntityTypeConfiguration<Company>
    {
        public void Configure(EntityTypeBuilder<Company> builder)
        {
            builder.HasKey(c => c.CompanyId);
            builder.Property(e => e.Name).IsRequired().HasMaxLength(255);
            builder.Property(e => e.Phone_Number).IsRequired().HasMaxLength(255);
            builder.Property(e => e.Numer_Biznesit).IsRequired().HasMaxLength(255);
            builder.Property(e => e.Email).IsRequired().HasMaxLength(255);
            builder.Property(e => e.Address).IsRequired().HasMaxLength(255);
            builder.Property(e => e.Industry).IsRequired().HasMaxLength(255);
            builder.Property(e => e.CreatedAt).IsRequired().HasDefaultValueSql("GETDATE()");
            builder.Property(e => e.UpdatedAt).IsRequired().HasDefaultValueSql("GETDATE()");
        }
    }
}
