using Application.DTOs;
using Core.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
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
        Task<IEnumerable<OrderExportDto>> GetOrdersForExportAsync();
        Task<(List<CreateOrderDto> Succeeded, List<string> Failed)> ImportOrdersAsync(IFormFile file, string format, string actingUserId);
        Task<OrderExportDto?> GetOrderForExportByIdAsync(int orderId);
        Task<bool> AssignWorkersToOrderAsync(string orderId, List<string> workerIds, string actingUserId);
        Task<IEnumerable<Order>> GetOrdersAssignedToWorkerAsync(string workerId);
    }
}
