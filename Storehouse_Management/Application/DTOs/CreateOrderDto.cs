using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class CreateOrderDto
    {
        public List<OrderItemDto> OrderItems { get; set; } = new List<OrderItemDto>();
        public string? UserId { get; set; } 
    }
}
