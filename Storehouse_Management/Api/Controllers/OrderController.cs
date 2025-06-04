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
using QuestPDF.Fluent;


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
            var actingUserIdFromToken = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(actingUserIdFromToken))
            {
                Console.WriteLine($"ERROR (Controller): User identity not found in token.");
                return Unauthorized(new { message = "User identity not found in token." });
            }

            Console.WriteLine($"INFO (Controller): CreateOrder Action START. ClientName from DTO: {request?.ClientName}, Acting User from Token: {actingUserIdFromToken}");
            // var actingUser = await _context.Users.FindAsync(request.UserId); // REMOVE THIS LINE

            // The service will now fetch the user's companyId based on actingUserIdFromToken
            // You no longer need to pass the user object or fetch it here for company ID.

            try
            {
                // Pass the actingUserIdFromToken to the service
                Order order = await _orderService.CreateOrderAsync(request, actingUserIdFromToken);
                Console.WriteLine($"INFO (Controller): Service call completed. Order ID: {order.OrderId}. Company ID: {order.CompanyId}");

                // Fetch actingUser again if you need UserName for notification,
                // or modify service to return it, or get it from claims if available.
                var actingUserForNotification = await _context.Users.FindAsync(actingUserIdFromToken);

                var notificationDto = new OrderCreatedNotificationDto
                {
                    OrderId = order.OrderId,
                    ClientName = order.ClientName ?? "N/A",
                    TotalPrice = order.TotalPrice,
                    Status = order.Status,
                    CreatedAt = order.Created,
                    CreatedByUserName = actingUserForNotification?.UserName ?? "Unknown User" // Use fetched user
                };
                await _hubContext.Clients.All.SendAsync("ReceiveOrderCreated", notificationDto);
                Console.WriteLine($"INFO (Controller): Sent SignalR notification for new order {order.OrderId}.");

                return CreatedAtAction(nameof(GetOrder), new { id = order.OrderId }, order);
            }
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
            // 1. Get User ID from Token
            var currentUserIdFromToken = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserIdFromToken))
            {
                return Unauthorized(new { message = "User identity not found." });
            }

            // 2. Fetch User from Database (only need CompaniesId)
            // We can optimize this to only select CompaniesId if that's the only property needed from currentUser
            // For simplicity and if currentUser might be used for other things later, fetching the whole object is fine.
            var currentUser = await _context.Users
                                        .AsNoTracking()
                                        .FirstOrDefaultAsync(u => u.Id == currentUserIdFromToken);

            if (currentUser == null)
            {
                return NotFound(new { message = "User profile not found." });
            }

            // 3. Check if the user is associated with a company
            if (currentUser.CompaniesId == null)
            {
                // If a user MUST be associated with a company to see orders,
                // you might consider returning NotFound or BadRequest here.
                // Returning an empty list is also a valid approach, as in the original.
                return Ok(Enumerable.Empty<Order>());
            }

            // 4. Get the Company ID the user belongs to
            var userCompanyId = currentUser.CompaniesId.Value;

            // 5. Fetch orders for the user's specific company
            var orders = await _context.Orders
                                    .Where(o => o.CompanyId == userCompanyId)
                                    .Include(o => o.AppUsers)  // Keep if you need related users
                                    .Include(o => o.Company)   // Keep if you need related company details
                                    .OrderByDescending(o => o.Created)
                                    .ToListAsync();

            // 6. Return orders for the user's company
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

                var notificationDto = new OrderStatusUpdateNotificationDto
                {
                    OrderId = orderToUpdate.OrderId,
                    NewStatus = orderToUpdate.Status,
                    OldStatus = oldStatus,
                    UpdatedByUserName = actingUserId ?? "Unknown User",
                    Description = request.Description,
                    Timestamp = DateTime.UtcNow
                };
                await _hubContext.Clients.All.SendAsync("ReceiveOrderStatusUpdate", notificationDto);
                Console.WriteLine($"INFO (Controller): Sent SignalR notification for order {id} status update to {request.Status}.");

                return NoContent();
            }
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

        [HttpGet("{orderId}/invoice"), Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> GenerateOrderInvoice(int orderId)
        {
            var orderWithItemsDto = await _orderService.GetOrderForExportByIdAsync(orderId);

            if (orderWithItemsDto == null)
            {
                Console.WriteLine($"WARN (Controller): Order with ID {orderId} not found for invoice generation.");
                return NotFound(new { message = $"Order with ID {orderId} not found." });
            }

            var companyInfo = await _context.Companies.FirstOrDefaultAsync();

            if (companyInfo == null)
            {
                Console.WriteLine($"WARN (Controller): Company information not found in DB. Using placeholders for invoice for order {orderId}.");
            }

            string sanitizedClientName = "UnknownClient";
            if (!string.IsNullOrWhiteSpace(orderWithItemsDto.ClientName))
            {
                sanitizedClientName = new string(orderWithItemsDto.ClientName
                    .Where(c => !Path.GetInvalidFileNameChars().Contains(c))
                    .ToArray()).Replace(" ", "_").Trim();
                if (sanitizedClientName.Length > 50) sanitizedClientName = sanitizedClientName.Substring(0, 50);
                if (string.IsNullOrWhiteSpace(sanitizedClientName)) sanitizedClientName = "ClientInvoice";
            }

            try
            {
                Console.WriteLine($"INFO (Controller): Generating PDF invoice for Order ID: {orderId}, Client: {sanitizedClientName}");
                var invoiceDocument = new InvoiceDocument(orderWithItemsDto, companyInfo);

                byte[] pdfBytes = invoiceDocument.GeneratePdf();

                string fileName = $"Invoice_{sanitizedClientName}_{orderId}_{DateTime.UtcNow:yyyyMMddHHmmss}.pdf";

                Console.WriteLine($"INFO (Controller): PDF invoice '{fileName}' generated successfully for Order ID: {orderId}.");
                return File(pdfBytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR (Controller): Failed to generate PDF invoice for Order ID {orderId}. Error: {ex.Message}");
                Console.WriteLine($"FULL STACK TRACE (Controller PDF Invoice Generation): {ex.ToString()}");
                return StatusCode(500, new { message = "An error occurred while generating the invoice PDF." });
            }
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