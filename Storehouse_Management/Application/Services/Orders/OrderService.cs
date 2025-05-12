using Application.DTOs;
using Application.Interfaces;
using Application.Services.Products;
using ClosedXML.Excel;
using Core.Entities;
using CsvHelper.Configuration;
using CsvHelper;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace Application.Services.Orders
{
    public class OrderService : IOrderService
    {
        private readonly IAppDbContext _sqlContext;
        private readonly ProductService _productService;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IMongoCollection<Product> _productsMongoCollection;

        public OrderService(
            IAppDbContext sqlContext,
            IMongoClient mongoClient,
            IMongoDbSettings mongoSettings,
            ProductService productService,
            IHttpContextAccessor httpContextAccessor)
        {
            _sqlContext = sqlContext;
            _productService = productService;
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

        private async Task<Dictionary<string, string>> GetProductNamesAsync(IEnumerable<string> productIds)
        {
            if (productIds == null || !productIds.Any())
            {
                return new Dictionary<string, string>();
            }
            return await _productService.GetProductNamesAsync(productIds);
        }

        public async Task<IEnumerable<OrderExportDto>> GetOrdersForExportAsync()
        {
            var ordersFromSql = await _sqlContext.Orders
                .Include(o => o.AppUsers)
                .Include(o => o.OrderItems)
                .OrderByDescending(o => o.Created)
                .ToListAsync();

            if (!ordersFromSql.Any()) return Enumerable.Empty<OrderExportDto>();

            var allProductIds = ordersFromSql
                .SelectMany(o => o.OrderItems)
                .Select(oi => oi.ProductsId)
                .Where(id => !string.IsNullOrEmpty(id))
                .Distinct()
                .ToList();

            var productNamesMap = await GetProductNamesAsync(allProductIds);

            return ordersFromSql.Select(o => new OrderExportDto
            {
                OrderId = o.OrderId,
                Status = o.Status,
                Created = o.Created,
                TotalPrice = o.TotalPrice,
                UserId = o.UserId,
                UserName = o.AppUsers != null ? o.AppUsers.UserName : null,
                ClientName = o.ClientName,
                ClientPhoneNumber = o.ClientPhoneNumber,
                ShippingAddressStreet = o.ShippingAddressStreet,
                ShippingAddressCity = o.ShippingAddressCity,
                ShippingAddressPostalCode = o.ShippingAddressPostalCode,
                ShippingAddressCountry = o.ShippingAddressCountry,
                OrderItems = o.OrderItems.Select(oi => new OrderItemExportDto
                {
                    OrderItemId = oi.OrderItemId,
                    ProductsId = oi.ProductsId,
                    ProductName = !string.IsNullOrEmpty(oi.ProductsId) && productNamesMap.TryGetValue(oi.ProductsId, out var name) ? name : "Unknown Product",
                    Quantity = oi.Quantity,
                    Price = oi.Price
                }).ToList()
            }).ToList();
        }

        public async Task<OrderExportDto?> GetOrderForExportByIdAsync(int orderId)
        {
            var orderFromSql = await _sqlContext.Orders
                .Where(o => o.OrderId == orderId)
                .Include(o => o.AppUsers)
                .Include(o => o.OrderItems)
                .FirstOrDefaultAsync();

            if (orderFromSql == null) return null;

            var productIdsInOrder = orderFromSql.OrderItems
                .Select(oi => oi.ProductsId)
                .Where(id => !string.IsNullOrEmpty(id))
                .Distinct()
                .ToList();

            var productNamesMap = await GetProductNamesAsync(productIdsInOrder);

            return new OrderExportDto
            {
                OrderId = orderFromSql.OrderId,
                Status = orderFromSql.Status,
                Created = orderFromSql.Created,
                TotalPrice = orderFromSql.TotalPrice,
                UserId = orderFromSql.UserId,
                UserName = orderFromSql.AppUsers != null ? orderFromSql.AppUsers.UserName : null,
                ClientName = orderFromSql.ClientName,
                ClientPhoneNumber = orderFromSql.ClientPhoneNumber,
                ShippingAddressStreet = orderFromSql.ShippingAddressStreet,
                ShippingAddressCity = orderFromSql.ShippingAddressCity,
                ShippingAddressPostalCode = orderFromSql.ShippingAddressPostalCode,
                ShippingAddressCountry = orderFromSql.ShippingAddressCountry,
                OrderItems = orderFromSql.OrderItems.Select(oi => new OrderItemExportDto
                {
                    OrderItemId = oi.OrderItemId,
                    ProductsId = oi.ProductsId,
                    ProductName = !string.IsNullOrEmpty(oi.ProductsId) && productNamesMap.TryGetValue(oi.ProductsId, out var name) ? name : "Unknown Product",
                    Quantity = oi.Quantity,
                    Price = oi.Price
                }).ToList()
            };
        }

        public async Task<(List<CreateOrderDto> Succeeded, List<string> Failed)> ImportOrdersAsync(IFormFile file, string format, string actingUserId)
        {
            var importedOrdersDto = new List<CreateOrderDto>();
            var successfullyCreatedOrders = new List<CreateOrderDto>();
            var failedImportEntries = new List<string>();

            if (file == null || file.Length == 0)
            {
                failedImportEntries.Add("File is empty or not provided.");
                return (successfullyCreatedOrders, failedImportEntries);
            }

            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            stream.Position = 0;

            try
            {
                using var reader = new StreamReader(stream);
                if (format.Equals("csv", StringComparison.OrdinalIgnoreCase))
                {
                    var config = new CsvConfiguration(CultureInfo.InvariantCulture)
                    {
                        HeaderValidated = null,
                        MissingFieldFound = null,
                        PrepareHeaderForMatch = args => args.Header.ToLower(),
                    };
                    using var csv = new CsvReader(reader, config);
                    
                    var records = csv.GetRecords<CreateOrderDto>().ToList();
                    importedOrdersDto.AddRange(records);
                }
                else if (format.Equals("json", StringComparison.OrdinalIgnoreCase))
                {
                    var jsonString = await reader.ReadToEndAsync();
                    importedOrdersDto = JsonSerializer.Deserialize<List<CreateOrderDto>>(jsonString, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                                      ?? new List<CreateOrderDto>();
                }
                else if (format.Equals("excel", StringComparison.OrdinalIgnoreCase))
                {
                    stream.Position = 0;
                    using var workbook = new XLWorkbook(stream);
                    var worksheet = workbook.Worksheets.FirstOrDefault();
                    if (worksheet == null)
                    {
                        failedImportEntries.Add("Excel file does not contain any worksheets.");
                        return (successfullyCreatedOrders, failedImportEntries);
                    }

                    var headerRow = worksheet.Row(1);
                    var rows = worksheet.RowsUsed().Skip(1);

                    foreach (var row in rows)
                    {
                        try
                        {
                            var dto = new CreateOrderDto
                            {
                                ClientName = row.Cell(1).GetValue<string>(),
                                ClientPhoneNumber = row.Cell(2).GetValue<string>(),
                                ShippingAddressStreet = row.Cell(3).GetValue<string>(),
                            };

                            if (string.IsNullOrWhiteSpace(dto.ClientName))
                            {
                                failedImportEntries.Add($"Row {row.RowNumber()}: ClientName is missing.");
                                continue;
                            }
                            importedOrdersDto.Add(dto);
                        }
                        catch (Exception ex)
                        {
                            failedImportEntries.Add($"Error processing Excel row {row.RowNumber()}: {ex.Message}");
                        }
                    }
                }
                else
                {
                    failedImportEntries.Add("Unsupported file format specified.");
                    return (successfullyCreatedOrders, failedImportEntries);
                }
            }
            catch (Exception ex)
            {
                failedImportEntries.Add($"Error reading file: {ex.Message}");
                return (successfullyCreatedOrders, failedImportEntries);
            }


            foreach (var orderDto in importedOrdersDto)
            {
                try
                {
                    orderDto.UserId = actingUserId;

                    if (orderDto.OrderItems == null || !orderDto.OrderItems.Any())
                    {
                        orderDto.OrderItems = new List<OrderItemDto>
                        {
                            
                        };
                        failedImportEntries.Add($"Order for client '{orderDto.ClientName}' missing OrderItems.");
                        continue;
                    }


                    await CreateOrderAsync(orderDto, actingUserId);
                    successfullyCreatedOrders.Add(orderDto);
                }
                catch (ArgumentException ex)
                {
                    failedImportEntries.Add($"Validation error for order (Client: {orderDto.ClientName}): {ex.Message}");
                }
                catch (Exception ex)
                {
                    failedImportEntries.Add($"Failed to create order (Client: {orderDto.ClientName}): {ex.Message}");
                }
            }

            return (successfullyCreatedOrders, failedImportEntries);
        }
    }
}
