using Application.DTOs;
using Core.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.Interfaces
{
    public interface IOrderService
    {
        Task<Order> CreateOrderAsync(CreateOrderDto request, string userId);
        Task<Order?> GetOrderAsync(int id);
        Task<bool> UpdateOrderStatusAsync(int id, UpdateOrderDto request, string userId);
        Task<bool> CanUpdateStatusAsync(Order order, string newStatus, string userId);
    }
}
