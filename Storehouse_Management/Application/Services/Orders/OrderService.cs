using Application.DTOs;
using Application.Interfaces;
using Application.Services.Products;
using Core.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace Application.Services.Orders
{
    public class OrderService : IOrderService
    {
        private readonly IAppDbContext _context;
        private readonly ProductService _productService;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public OrderService(IAppDbContext context, ProductService productService, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _productService = productService;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<Order> CreateOrderAsync(CreateOrderDto request, string userId)
        {
            if (request == null || request.OrderItems == null || !request.OrderItems.Any())
            {
                throw new ArgumentException("Order must have at least one item.");
            }

            var order = new Order
            {
                Created = DateTime.UtcNow,
                Status = "Created",
                UserId = userId,
            };

            decimal totalPrice = 0;
            foreach (var itemRequest in request.OrderItems)
            {
                var product = await _productService.GetProductByIdAsync(itemRequest.ProductId);
                if (product == null)
                {
                    throw new ArgumentException($"Product with ID {itemRequest.ProductId} not found.");
                }

                var orderItem = new OrderItem
                {
                    ProductsId = itemRequest.ProductId,
                    Quantity = itemRequest.Quantity,
                    Price = product.Price
                };
                order.OrderItems.Add(orderItem);
                totalPrice += (decimal)(itemRequest.Quantity * product.Price);

            }

            order.TotalPrice = totalPrice;

            order.OrderStatusHistories.Add(new OrderStatusHistory
            {
                UpdatedByUserId = userId,
                Status = "Created",
                Timestamp = DateTime.UtcNow,
                Description = "Order Created"
            });

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();
            return order;
        }

        public async Task<Order?> GetOrderAsync(int id)
        {
            return await _context.Orders
                            .Include(o => o.OrderItems)
                            .Include(o => o.OrderStatusHistories)
                            .Include(o => o.AppUsers)
                            .FirstOrDefaultAsync(o => o.OrderId == id);
        }

        public async Task<bool> UpdateOrderStatusAsync(int id, UpdateOrderDto request, string userId)
        {
            var order = await _context.Orders.FindAsync(id);

            if (order == null)
            {
                return false;
            }

            if (!await CanUpdateStatusAsync(order, request.Status, userId))
            {
                return false;
            }

            order.Status = request.Status;

            order.OrderStatusHistories.Add(new OrderStatusHistory
            {
                UpdatedByUserId = userId,
                Status = request.Status,
                Timestamp = DateTime.UtcNow,
                Description = request.Description,
                OrdersId = order.OrderId
            });

            await _context.SaveChangesAsync();
            return true;

        }

        public async Task<bool> CanUpdateStatusAsync(Order order, string newStatus, string userId)
        {
            var role = _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Role);

            switch (role)
            {
                case "CompanyManager":
                    if (order.Status == "Created" && newStatus == "Canceled")
                    {
                        return true;
                    }
                    break;

                case "StorehouseManager":
                    if (order.Status == "Created" && (newStatus == "Billed" || newStatus == "ReadyForDelivery"))
                    {
                        return true;
                    }
                    break;

                case "Transporter":
                    if (order.Status == "ReadyForDelivery" && (newStatus == "InTransit" || newStatus == "Completed"))
                    {
                        return true;
                    }
                    if (order.Status == "InTransit" && (newStatus == "Completed" || newStatus == "Returned"))
                    {
                        return true;
                    }
                    break;
            }

            return false;
        }
    }
}
