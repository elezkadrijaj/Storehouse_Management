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
        private readonly IHttpContextAccessor _httpContextAccessor; // To access User Claims outside the controller

        public OrderService(IAppDbContext context, ProductService productService, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _productService = productService;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task<Order> CreateOrderAsync(CreateOrderDto request, string userId)
        {
            // 1. Validation:
            if (request == null || request.OrderItems == null || !request.OrderItems.Any())
            {
                throw new ArgumentException("Order must have at least one item.");
            }

            // 2. Create the Order
            var order = new Order
            {
                Created = DateTime.UtcNow,
                Status = "Created", // Initial status
                UserId = userId,
            };

            // 3. Add Order Items and calculate total price
            decimal totalPrice = 0;
            foreach (var itemRequest in request.OrderItems)
            {
                // 4.1. Fetch Product from MongoDB using ProductService
                var product = await _productService.GetProductByIdAsync(itemRequest.ProductId);
                if (product == null)
                {
                    throw new ArgumentException($"Product with ID {itemRequest.ProductId} not found.");
                }

                // 4.2. Create OrderItem
                var orderItem = new OrderItem
                {
                    ProductsId = itemRequest.ProductId, // Use the string ID
                    Quantity = itemRequest.Quantity,
                    Price = product.Price // VERY IMPORTANT:  Cast double to decimal
                };
                order.OrderItems.Add(orderItem);
                totalPrice += (decimal)(itemRequest.Quantity * product.Price); // Cast double to decimal

            }

            order.TotalPrice = totalPrice;

            // 5. Add initial OrderStatusHistory
            order.OrderStatusHistories.Add(new OrderStatusHistory
            {
                UpdatedByUserId = userId,
                Status = "Created",
                Timestamp = DateTime.UtcNow,
                Description = "Order Created"
            });

            //6. Add the Order
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

            //Authorization logic (Role-based and Status transition)
            if (!await CanUpdateStatusAsync(order, request.Status, userId))
            {
                return false;
            }

            //1. Update the order status
            order.Status = request.Status;

            //2. Add to OrderStatusHistory
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
                case "company_manager":
                    //Company manager can change order status from created to canceled
                    if (order.Status == "Created" && newStatus == "Canceled")
                    {
                        return true;
                    }
                    break;

                case "storehouse_worker":
                    //Storehouse worker can change order status from "Created" to "Billed" or "ReadyForDelivery"
                    if (order.Status == "Created" && (newStatus == "Billed" || newStatus == "ReadyForDelivery"))
                    {
                        return true;
                    }
                    break;

                case "transporter":
                    //Transporter can change order status from "ReadyForDelivery" to "InTransit" or "Completed"
                    if (order.Status == "ReadyForDelivery" && (newStatus == "InTransit" || newStatus == "Completed"))
                    {
                        return true;
                    }
                    //Transporter can change order status from "InTransit" to "Completed" or "Returned"
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
