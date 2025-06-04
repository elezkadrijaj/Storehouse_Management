using Microsoft.AspNetCore.Mvc;
using Infrastructure.Data;
using Core.Entities;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Application.DTOs;
using Application.Services.Products;
using Application.Services.Orders;
using Application.Interfaces;
using Microsoft.EntityFrameworkCore;
using ClosedXML.Excel;
using CsvHelper;
using System.Globalization;
using System.Text.Json;
using System.Text;
using Application.Hubs;
using Microsoft.AspNetCore.SignalR;


namespace Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OrdersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IOrderService _orderService;
        private readonly IHubContext<OrderNotificationHub> _hubContext;

        public OrdersController(AppDbContext context,IOrderService orderService, IHubContext<OrderNotificationHub> hubContext)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _orderService = orderService ?? throw new ArgumentNullException(nameof(orderService));
            _hubContext = hubContext ?? throw new ArgumentNullException(nameof(hubContext));
        }

        [HttpPost, Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto request)
        {
            Console.WriteLine($"INFO (Controller): CreateOrder Action START. ClientName from DTO: {request?.ClientName}");
            var actingUser = await _context.Users.FindAsync(request.UserId); // Assuming request.UserId is the AppUser.Id

            if (actingUser == null)
            {
                Console.WriteLine($"ERROR (Controller): User with ID '{request.UserId}' provided in request body not found.");
                return BadRequest(new { message = $"User with ID '{request.UserId}' not found." });
            }

            try
            {
                Order order = await _orderService.CreateOrderAsync(request, actingUser.Id);
                Console.WriteLine($"INFO (Controller): Service call completed. Order ID: {order.OrderId}.");

                // --- NOTIFICATION LOGIC ---
                var notificationDto = new OrderCreatedNotificationDto
                {
                    OrderId = order.OrderId,
                    ClientName = order.ClientName ?? "N/A",
                    TotalPrice = order.TotalPrice,
                    Status = order.Status,
                    CreatedAt = order.Created,
                    CreatedByUserName = actingUser.UserName ?? "Unknown User" // Or User.Identity.Name if actingUser.Id is from token
                };
                // Send to all connected clients.
                // You could also target specific groups or users:
                // e.g., await _hubContext.Clients.Group("StoreManagers").SendAsync("ReceiveOrderCreated", notificationDto);
                // e.g., await _hubContext.Clients.User(actingUser.Id).SendAsync("ReceiveOrderCreated", notificationDto); // Notify the creator
                await _hubContext.Clients.All.SendAsync("ReceiveOrderCreated", notificationDto);
                Console.WriteLine($"INFO (Controller): Sent SignalR notification for new order {order.OrderId}.");
                // --- END NOTIFICATION LOGIC ---

                return CreatedAtAction(nameof(GetOrder), new { id = order.OrderId }, order);
            }
            // ... (rest of your catch blocks and finally)
            catch (ArgumentException ex)
            {
                Console.WriteLine($"WARN (Controller): ArgumentException caught: {ex.Message}");
                return BadRequest(new { message = ex.Message });
            }
            catch (DbUpdateException dbEx)
            {
                Console.WriteLine($"ERROR (Controller): DbUpdateException caught. Message: {dbEx.Message}, Inner: {dbEx.InnerException?.Message}");
                return StatusCode(500, new { message = "A database error occurred while saving the order.", detail = dbEx.InnerException?.Message ?? dbEx.Message });
            }
            catch (InvalidOperationException ex)
            {
                Console.WriteLine($"ERROR (Controller): InvalidOperationException caught: {ex.Message}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"INNER EXCEPTION (Controller IOEX): Type={ex.InnerException.GetType().Name}, Msg={ex.InnerException.Message}");
                }
                return StatusCode(500, new { message = ex.Message, detail = "An operation failed during order processing. Order may be partially complete." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR (Controller): Unhandled generic exception: {ex.GetType().Name} - {ex.Message}");
                Console.WriteLine($"FULL STACK TRACE (Controller Generic Catch): {ex.ToString()}");
                return StatusCode(500, new { message = "An internal server error occurred while creating the order." });
            }
            finally
            {
                Console.WriteLine($"INFO (Controller): CreateOrder Action END. ClientName from DTO: {request?.ClientName}");
            }
        }

        [HttpGet, Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<ActionResult<IEnumerable<Order>>> GetOrders()
        {
            var orders = await _context.Orders
                                    .Include(o => o.AppUsers)
                                    .OrderByDescending(o => o.Created)
                                    .ToListAsync();
            return Ok(orders);
        }

        [HttpGet("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<ActionResult<Order>> GetOrder(int id)
        {
            var order = await _orderService.GetOrderAsync(id);
            if (order == null)
            {
                return NotFound(new { message = $"Order with ID {id} not found." });
            }
            return Ok(order);
        }

        [HttpPut("{id}/status"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateOrderDto request)
        {
            var actingUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(actingUserId))
            {
                return Unauthorized(new { message = "User identity not found in token." });
            }

            var orderToUpdate = await _context.Orders.Include(o => o.OrderStatusHistories).FirstOrDefaultAsync(o => o.OrderId == id);

            if (orderToUpdate == null)
            {
                return NotFound(new { message = $"Order with ID {id} not found." });
            }

            string oldStatus = orderToUpdate.Status; // Capture old status before update

            if (!await _orderService.CanUpdateStatusAsync(orderToUpdate, request.Status, actingUserId))
            {
                return Forbid("You do not have permission to update this order to the specified status or the status transition is invalid.");
            }

            orderToUpdate.Status = request.Status;
            orderToUpdate.OrderStatusHistories.Add(new OrderStatusHistory
            {
                UpdatedByUserId = actingUserId,
                Status = request.Status,
                Timestamp = DateTime.UtcNow,
                Description = request.Description,
                OrdersId = orderToUpdate.OrderId
            });

            try
            {
                await _context.SaveChangesAsync();

                // --- NOTIFICATION LOGIC ---
                var notificationDto = new OrderStatusUpdateNotificationDto
                {
                    OrderId = orderToUpdate.OrderId,
                    NewStatus = orderToUpdate.Status,
                    OldStatus = oldStatus,
                    UpdatedByUserName = actingUserId ?? "Unknown User",
                    Description = request.Description,
                    Timestamp = DateTime.UtcNow
                };
                // Send to all connected clients. Adjust targeting as needed.
                // e.g., await _hubContext.Clients.User(orderToUpdate.UserId).SendAsync("ReceiveOrderStatusUpdate", notificationDto); // Notify order owner
                await _hubContext.Clients.All.SendAsync("ReceiveOrderStatusUpdate", notificationDto);
                Console.WriteLine($"INFO (Controller): Sent SignalR notification for order {id} status update to {request.Status}.");
                // --- END NOTIFICATION LOGIC ---

                return NoContent();
            }
            // ... (rest of your catch blocks)
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(new { message = "The order was modified by another user. Please refresh and try again." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR updating order status for ID {id}: {ex.ToString()}");
                return StatusCode(500, new { message = "An error occurred while updating the order status." });
            }
        }

        private List<FlattenedOrderExportDto> FlattenOrderData(IEnumerable<OrderExportDto> ordersWithItems)
        {
            var flattenedList = new List<FlattenedOrderExportDto>();
            foreach (var order in ordersWithItems)
            {
                if (order.OrderItems.Any())
                {
                    foreach (var item in order.OrderItems)
                    {
                        flattenedList.Add(new FlattenedOrderExportDto
                        {
                            OrderId = order.OrderId,
                            OrderStatus = order.Status,
                            OrderCreated = order.Created,
                            OrderTotalPrice = order.TotalPrice,
                            UserId = order.UserId,
                            UserName = order.UserName,
                            ClientName = order.ClientName,
                            ClientPhoneNumber = order.ClientPhoneNumber,
                            ShippingAddressStreet = order.ShippingAddressStreet,
                            ShippingAddressCity = order.ShippingAddressCity,
                            ShippingAddressPostalCode = order.ShippingAddressPostalCode,
                            ShippingAddressCountry = order.ShippingAddressCountry,

                            OrderItemId = item.OrderItemId,
                            ProductsId = item.ProductsId,
                            ItemQuantity = item.Quantity,
                            ItemPrice = item.Price,
                            ItemTotal = item.TotalItemPrice
                        });
                    }
                }
                else
                {
                    flattenedList.Add(new FlattenedOrderExportDto
                    {
                        OrderId = order.OrderId,
                        OrderStatus = order.Status,
                        OrderCreated = order.Created,
                        OrderTotalPrice = order.TotalPrice,
                        UserId = order.UserId,
                        UserName = order.UserName,
                        ClientName = order.ClientName,
                        ClientPhoneNumber = order.ClientPhoneNumber,
                        ShippingAddressStreet = order.ShippingAddressStreet,
                        ShippingAddressCity = order.ShippingAddressCity,
                        ShippingAddressPostalCode = order.ShippingAddressPostalCode,
                        ShippingAddressCountry = order.ShippingAddressCountry,
                    });
                }
            }
            return flattenedList;
        }

        // format can be "csv", "excel", "json"
        [HttpGet("export/{format}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> ExportOrders(string format)
        {
            var ordersWithItems = await _orderService.GetOrdersForExportAsync();

            if (!ordersWithItems.Any())
            {
                return NotFound("No orders found to export.");
            }

            string contentType;
            string fileName;
            byte[] fileBytes;

            using var memoryStream = new MemoryStream();

            if (format.Equals("csv", StringComparison.OrdinalIgnoreCase))
            {
                contentType = "text/csv";
                fileName = $"orders_detailed_{DateTime.UtcNow:yyyyMMddHHmmss}.csv";
                var flattenedData = FlattenOrderData(ordersWithItems);
                using (var writer = new StreamWriter(memoryStream, Encoding.UTF8, 1024, true))
                using (var csv = new CsvWriter(writer, CultureInfo.InvariantCulture))
                {
                    await csv.WriteRecordsAsync(flattenedData);
                }
                fileBytes = memoryStream.ToArray();
            }
            else if (format.Equals("excel", StringComparison.OrdinalIgnoreCase))
            {
                contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                fileName = $"orders_detailed_{DateTime.UtcNow:yyyyMMddHHmmss}.xlsx";
                var flattenedData = FlattenOrderData(ordersWithItems);
                using (var workbook = new XLWorkbook())
                {
                    var worksheet = workbook.Worksheets.Add("OrdersDetailed");
                    worksheet.Cell(1, 1).InsertTable(flattenedData);
                    worksheet.Columns().AdjustToContents();
                    workbook.SaveAs(memoryStream);
                }
                fileBytes = memoryStream.ToArray();
            }
            else if (format.Equals("json", StringComparison.OrdinalIgnoreCase))
            {
                contentType = "application/json";
                fileName = $"orders_detailed_{DateTime.UtcNow:yyyyMMddHHmmss}.json";
                await JsonSerializer.SerializeAsync(memoryStream, ordersWithItems, new JsonSerializerOptions { WriteIndented = true });
                fileBytes = memoryStream.ToArray();
            }
            else
            {
                return BadRequest("Unsupported format. Supported formats: csv, excel, json.");
            }

            return File(fileBytes, contentType, fileName);
        }

        [HttpGet("{orderId}/export/{format}"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> ExportSingleOrder(int orderId, string format)
        {
            var orderWithItemsDto = await _orderService.GetOrderForExportByIdAsync(orderId);

            if (orderWithItemsDto == null)
            {
                return NotFound(new { message = $"Order with ID {orderId} not found." });
            }

            string contentType;
            string fileName;
            byte[] fileBytes;

            string sanitizedClientName = "UnknownClient";
            if (!string.IsNullOrWhiteSpace(orderWithItemsDto.ClientName))
            {
                sanitizedClientName = new string(orderWithItemsDto.ClientName
                    .Where(c => !Path.GetInvalidFileNameChars().Contains(c))
                    .ToArray());
                sanitizedClientName = sanitizedClientName.Replace(" ", "_");
                if (sanitizedClientName.Length > 50)
                {
                    sanitizedClientName = sanitizedClientName.Substring(0, 50);
                }
                if (string.IsNullOrWhiteSpace(sanitizedClientName))
                {
                    sanitizedClientName = "ClientOrder";
                }
            }

            using var memoryStream = new MemoryStream();

            if (format.Equals("csv", StringComparison.OrdinalIgnoreCase))
            {
                contentType = "text/csv";
                fileName = $"order_{sanitizedClientName}_{orderId}_{DateTime.UtcNow:yyyyMMddHHmmss}.csv";
                var flattenedData = FlattenOrderData(new List<OrderExportDto> { orderWithItemsDto });
                using (var writer = new StreamWriter(memoryStream, Encoding.UTF8, 1024, true))
                using (var csv = new CsvWriter(writer, CultureInfo.InvariantCulture))
                {
                    await csv.WriteRecordsAsync(flattenedData);
                }
                fileBytes = memoryStream.ToArray();
            }
            else if (format.Equals("excel", StringComparison.OrdinalIgnoreCase))
            {
                contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                fileName = $"order_{sanitizedClientName}_{orderId}_{DateTime.UtcNow:yyyyMMddHHmmss}.xlsx";
                var flattenedData = FlattenOrderData(new List<OrderExportDto> { orderWithItemsDto });
                using (var workbook = new XLWorkbook())
                {
                    var worksheet = workbook.Worksheets.Add($"Order_{orderId}_Detailed");
                    worksheet.Cell(1, 1).InsertTable(flattenedData);
                    worksheet.Columns().AdjustToContents();
                    workbook.SaveAs(memoryStream);
                }
                fileBytes = memoryStream.ToArray();
            }
            else if (format.Equals("json", StringComparison.OrdinalIgnoreCase))
            {
                contentType = "application/json";
                fileName = $"order_{sanitizedClientName}_{orderId}_{DateTime.UtcNow:yyyyMMddHHmmss}.json";
                await JsonSerializer.SerializeAsync(memoryStream, orderWithItemsDto, new JsonSerializerOptions { WriteIndented = true });
                fileBytes = memoryStream.ToArray();
            }
            else
            {
                return BadRequest("Unsupported format. Supported formats: csv, excel, json.");
            }

            return File(fileBytes, contentType, fileName);
        }

        [HttpPost("import/{format}"), Authorize(Policy = "StorehouseAccessPolicy")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> ImportOrders(string format, IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("File not provided or empty.");
            }

            var actingUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(actingUserId))
            {
                return Unauthorized("User identity not found.");
            }

            var (succeeded, failed) = await _orderService.ImportOrdersAsync(file, format, actingUserId);

            if (!succeeded.Any() && failed.Any())
            {
                return BadRequest(new { message = "All order imports failed.", errors = failed });
            }

            return Ok(new
            {
                message = $"Import process completed. {succeeded.Count} orders imported successfully. {failed.Count} failed.",
                successfulImports = succeeded.Select(o => o.ClientName),
                errors = failed
            });
        }
    }
}