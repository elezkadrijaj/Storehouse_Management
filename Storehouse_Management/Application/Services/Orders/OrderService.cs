using Application.DTOs;
using Application.Interfaces;
using Application.Services.Products;
using Core.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;
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
        private readonly IAppDbContext _sqlContext;
        private readonly ProductService _productReadService;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IMongoCollection<Product> _productsMongoCollection;

        public OrderService(
            IAppDbContext sqlContext,
            ProductService productReadService,
            IHttpContextAccessor httpContextAccessor,
            IMongoClient mongoClient,
            IMongoDbSettings mongoSettings)
        {
            _sqlContext = sqlContext;
            _productReadService = productReadService;
            _httpContextAccessor = httpContextAccessor;

            var database = mongoClient.GetDatabase(mongoSettings.DatabaseName);
            _productsMongoCollection = database.GetCollection<Product>("Products");
        }

        public async Task<Order> CreateOrderAsync(CreateOrderDto request, string actingUserId)
        {
            Order? order = null;
            Console.WriteLine($"INFO (Service): CreateOrderAsync started. Received Acting User ID: '{actingUserId}'");

            if (string.IsNullOrEmpty(actingUserId))
            {
                Console.WriteLine("ERROR (Service-Validation): Acting User ID is null or empty.");
                throw new ArgumentNullException(nameof(actingUserId), "Acting user ID cannot be null or empty.");
            }

            if (request == null || request.OrderItems == null || !request.OrderItems.Any())
            {
                Console.WriteLine("ERROR (Service-Validation): Order must have at least one item.");
                throw new ArgumentException("Order must have at least one item.");
            }
            if (string.IsNullOrWhiteSpace(request.ShippingAddressStreet))
            {
                Console.WriteLine("ERROR (Service-Validation): Shipping address street is required.");
                throw new ArgumentException("Shipping address street is required.");
            }
            Console.WriteLine("INFO (Service): Initial DTO validations passed.");

            order = new Order
            {
                Created = DateTime.UtcNow,
                Status = "Created",
                UserId = actingUserId,

                ClientName = request.ClientName,
                ClientPhoneNumber = request.ClientPhoneNumber,
                ShippingAddressStreet = request.ShippingAddressStreet,
                ShippingAddressCity = request.ShippingAddressCity,
                ShippingAddressPostalCode = request.ShippingAddressPostalCode,
                ShippingAddressCountry = request.ShippingAddressCountry
            };
            Console.WriteLine($"INFO (Service): Order entity created. UserId to be saved: '{order.UserId}', Client: {order.ClientName}");

            decimal totalPrice = 0;
            var productStockUpdates = new List<(string ProductId, int QuantityToDecrement)>();
            Console.WriteLine("INFO (Service): Processing order items...");
            foreach (var itemRequest in request.OrderItems)
            {
                Console.WriteLine($"INFO (Service): Item - Product ID: {itemRequest.ProductId}, Qty: {itemRequest.Quantity}");
                var product = await GetProductFromMongoByIdAsync(itemRequest.ProductId);
                if (product == null)
                {
                    Console.WriteLine($"ERROR (Service-Product): Product ID {itemRequest.ProductId} not found in MongoDB.");
                    throw new ArgumentException($"Product with ID {itemRequest.ProductId} not found.");
                }
                if (product.Stock < itemRequest.Quantity)
                {
                    Console.WriteLine($"ERROR (Service-Stock): Insufficient stock for Product ID {itemRequest.ProductId}. Avail: {product.Stock}, Req: {itemRequest.Quantity}");
                    throw new ArgumentException($"Insufficient stock for Product ID {itemRequest.ProductId}. Available: {product.Stock}, Requested: {itemRequest.Quantity}");
                }

                var orderItem = new OrderItem
                {
                    ProductsId = itemRequest.ProductId,
                    Quantity = itemRequest.Quantity,
                    Price = product.Price
                };
                order.OrderItems.Add(orderItem);
                totalPrice += (decimal)(itemRequest.Quantity * product.Price);
                productStockUpdates.Add((product.ProductId, itemRequest.Quantity));
            }
            order.TotalPrice = totalPrice;
            Console.WriteLine($"INFO (Service): Total Price calculated: {order.TotalPrice}");

            order.OrderStatusHistories.Add(new OrderStatusHistory
            {
                UpdatedByUserId = actingUserId,
                Status = "Created",
                Timestamp = DateTime.UtcNow,
                Description = "Order Created"
            });
            Console.WriteLine("INFO (Service): Initial OrderStatusHistory added.");

            try
            {
                _sqlContext.Orders.Add(order);
                Console.WriteLine($"INFO (Service): Attempting to save Order to SQL DB. UserId being saved: '{order.UserId}'. Client: {order.ClientName}. Items: {order.OrderItems.Count}, History: {order.OrderStatusHistories.Count}");
                await _sqlContext.SaveChangesAsync();
                Console.WriteLine($"INFO (Service): Successfully saved Order ID: {order.OrderId} to SQL DB.");
            }
            catch (DbUpdateException dbEx)
            {
                Console.WriteLine($"ERROR (Service-SQL SAVE): DbUpdateException for Order (UserId='{order?.UserId}', Client='{order?.ClientName}'). Message: {dbEx.Message}");
                if (dbEx.InnerException != null)
                {
                    Console.WriteLine($"INNER EXCEPTION (SQL SAVE): {dbEx.InnerException.GetType().Name} - {dbEx.InnerException.Message}");
                    if (dbEx.InnerException is SqlException sqlEx)
                    {
                        Console.WriteLine($"SQL Exception Number: {sqlEx.Number}");
                        foreach (SqlError error in sqlEx.Errors)
                        {
                            Console.WriteLine($"  SQL Error: Line={error.LineNumber}, Msg='{error.Message}'");
                        }
                    }
                }
                Console.WriteLine($"FULL STACK TRACE (DbUpdateException - SQL SAVE): {dbEx.ToString()}");
                throw new Exception("A database error occurred while saving the order details.", dbEx);
            }
            Console.WriteLine($"INFO (Service): Attempting to update MongoDB stock for Order ID: {order.OrderId}...");
            try
            {
                foreach (var stockUpdate in productStockUpdates)
                {
                    Console.WriteLine($"INFO (Service): --> Mongo Stock Update for Product: {stockUpdate.ProductId}, Qty: {stockUpdate.QuantityToDecrement}");
                    await DecrementProductStockInMongoAsync(stockUpdate.ProductId, stockUpdate.QuantityToDecrement);
                }
                Console.WriteLine($"INFO (Service): Successfully updated MongoDB stock for Order ID: {order.OrderId}.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR (Service-MONGO UPDATE): Order {order.OrderId} created, but failed to update product stock in MongoDB. Error: {ex.Message}");
                Console.WriteLine($"FULL STACK TRACE (MONGO UPDATE Exc): {ex.ToString()}");
                throw new InvalidOperationException($"Order created (ID: {order.OrderId}), but failed to update product stock. Please verify inventory.", ex);
            }

            Console.WriteLine($"INFO (Service): CreateOrderAsync completed successfully for Order ID: {order.OrderId}.");
            return order;
        }

        private async Task<Product?> GetProductFromMongoByIdAsync(string productId)
        {
            var filter = Builders<Product>.Filter.Eq(p => p.ProductId, productId);
            return await _productsMongoCollection.Find(filter).FirstOrDefaultAsync();
        }

        private async Task DecrementProductStockInMongoAsync(string productId, int quantityToDecrement)
        {
            var filter = Builders<Product>.Filter.Eq(p => p.ProductId, productId);

            var update = Builders<Product>.Update.Inc(p => p.Stock, -quantityToDecrement);
            var result = await _productsMongoCollection.UpdateOneAsync(filter, update);

            if (result.IsAcknowledged && result.MatchedCount > 0 && result.ModifiedCount == 0)
            {
                throw new InvalidOperationException($"Failed to decrement stock for Product ID {productId}. Product found but not updated (stock might be too low or concurrent update occurred).");
            }
            else if (!result.IsAcknowledged || result.MatchedCount == 0)
            {
                throw new InvalidOperationException($"Failed to decrement stock for Product ID {productId}. Product not found or update was not acknowledged.");
            }
        }

        public async Task<Order?> GetOrderAsync(int id)
        {
            return await _sqlContext.Orders
                            .Include(o => o.OrderItems)
                            .Include(o => o.OrderStatusHistories)
                            .Include(o => o.AppUsers)
                            .FirstOrDefaultAsync(o => o.OrderId == id);
        }

        public async Task<bool> UpdateOrderStatusAsync(int id, UpdateOrderDto request, string userId)
        {
            var order = await _sqlContext.Orders.Include(o => o.OrderStatusHistories).FirstOrDefaultAsync(o => o.OrderId == id);

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

            await _sqlContext.SaveChangesAsync();
            return true;
        }

        public async Task<bool> CanUpdateStatusAsync(Order order, string newStatus, string userId)
        {
            var role = _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Role);
            bool canUpdate = false;
            switch (role)
            {
                case "CompanyManager":
                    if (order.Status == "Created" && newStatus == "Canceled") canUpdate = true;
                    break;
                case "StorehouseManager":
                    if (order.Status == "Created" && (newStatus == "Billed" || newStatus == "ReadyForDelivery")) canUpdate = true;
                    break;
                case "Transporter":
                    if (order.Status == "ReadyForDelivery" && (newStatus == "InTransit" || newStatus == "Completed")) canUpdate = true;
                    if (order.Status == "InTransit" && (newStatus == "Completed" || newStatus == "Returned")) canUpdate = true;
                    break;
            }
            return canUpdate;
        }
    }
}
