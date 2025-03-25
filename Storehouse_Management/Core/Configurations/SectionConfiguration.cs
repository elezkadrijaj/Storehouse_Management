using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Core.Configurations
{
    public class SectionConfiguration : IEntityTypeConfiguration<Section>

    {
        public void Configure(EntityTypeBuilder<Section> builder)
        {
            builder.HasOne(e => e.Storehouses)
                .WithMany()
                .HasForeignKey(e => e.StorehousesId);
        }
    }
}
