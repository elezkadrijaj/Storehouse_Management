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
    public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
    {
        public void Configure(EntityTypeBuilder<OrderItem> builder)
        {
            builder.HasKey(c => c.OrderItemId);
            builder.Property(e => e.Quantity).IsRequired();
            builder.Property(e => e.Price).IsRequired();

            builder.HasOne(e => e.Orders)
                .WithMany(o => o.OrderItems)
                .HasForeignKey(e => e.OrdersId);

            //builder.HasOne(e => e.Products)
            //    .WithMany()
            //    .HasForeignKey(e => e.ProductsId)
            //    .IsRequired();
        }
    }
}
