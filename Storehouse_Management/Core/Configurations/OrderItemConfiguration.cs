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
            builder.HasOne(e => e.Orders)
                .WithMany()
                .HasForeignKey(e => e.OrdersId);

            builder.HasOne(e => e.Products)
                .WithMany()
                .HasForeignKey(e => e.ProductsId);
        }
        
    }
}
