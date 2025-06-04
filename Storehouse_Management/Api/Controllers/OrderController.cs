using Microsoft.AspNetCore.Mvc;
using Infrastructure.Data;
using Core.Entities;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Application.DTOs;
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

        private readonly List<string> _relevantSalesStatuses = new List<string> {
            "Created", 
            "Completed",
            "Shipped",
            "Delivered",
            "Paid"
        };

        public OrdersController(AppDbContext context, IOrderService orderService, IHubContext<OrderNotificationHub> hubContext)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _orderService = orderService ?? throw new ArgumentNullException(nameof(orderService));
            _hubContext = hubContext ?? throw new ArgumentNullException(nameof(hubContext));
        }



        private async Task<(decimal SalesAmount, int OrderCount)> GetSalesDataForPeriod(string periodName, DateTime startDate, DateTime endDate)
        {
            Console.WriteLine($"--- Calculating for Period: {periodName} ---");
            Console.WriteLine($"Start Date (UTC): {startDate:o}");
            Console.WriteLine($"End Date (UTC):   {endDate:o}");
            Console.WriteLine($"Relevant Statuses: {string.Join(", ", _relevantSalesStatuses)}");

            var ordersInPeriod = await _context.Orders
                .Where(o => o.Created >= startDate && o.Created < endDate && _relevantSalesStatuses.Contains(o.Status))
                .ToListAsync();

            Console.WriteLine($"Found {ordersInPeriod.Count} orders in '{periodName}' matching criteria.");
            foreach (var order in ordersInPeriod)
            {
                Console.WriteLine($"  - OrderID: {order.OrderId}, Status: {order.Status}, Created: {order.Created:o}, TotalPrice: {order.TotalPrice}");
            }

            decimal totalSales = ordersInPeriod.Sum(o => o.TotalPrice);
            Console.WriteLine($"Total Sales for '{periodName}': {totalSales}");
            Console.WriteLine($"--- End Calculation for Period: {periodName} ---");
            return (totalSales, ordersInPeriod.Count);
        }

        [HttpGet("sales-summary")]
        [Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> GetSalesSummary()
        {
            var now = DateTime.UtcNow;
            Console.WriteLine($"\n\n--- GetSalesSummary Called at UTC: {now:o} ---");

            var todayStart = now.Date; 
            var todayEnd = todayStart.AddDays(1);
            var yesterdayStart = todayStart.AddDays(-1); 

            var (dailySalesAmount, _) = await GetSalesDataForPeriod("Daily", todayStart, todayEnd);
            var (yesterdaySalesAmount, _) = await GetSalesDataForPeriod("Yesterday", yesterdayStart, todayStart);

            var dailyTrend = "neutral";
            if (dailySalesAmount > yesterdaySalesAmount) dailyTrend = "up";
            else if (dailySalesAmount < yesterdaySalesAmount) dailyTrend = "down";

            double dailyPercentageChange = 0;
            if (yesterdaySalesAmount > 0) dailyPercentageChange = (double)((dailySalesAmount - yesterdaySalesAmount) / yesterdaySalesAmount) * 100;
            else if (dailySalesAmount > 0) dailyPercentageChange = 100;
            double dailyProgressBarPercentage = yesterdaySalesAmount > 0 ? Math.Min(100.0, (double)(dailySalesAmount / yesterdaySalesAmount) * 100.0) : (dailySalesAmount > 0 ? 100.0 : 0.0);

            var currentMonthStart = new DateTime(now.Year, now.Month, 1);
            var currentMonthEnd = currentMonthStart.AddMonths(1);
            var previousMonthStart = currentMonthStart.AddMonths(-1);

            var (monthlySalesAmount, _) = await GetSalesDataForPeriod("Current Month", currentMonthStart, currentMonthEnd);
            var (previousMonthSalesAmount, _) = await GetSalesDataForPeriod("Previous Month", previousMonthStart, currentMonthStart);

            var monthlyTrend = "neutral";
            if (monthlySalesAmount > previousMonthSalesAmount) monthlyTrend = "up";
            else if (monthlySalesAmount < previousMonthSalesAmount) monthlyTrend = "down";

            double monthlyPercentageChange = 0;
            if (previousMonthSalesAmount > 0) monthlyPercentageChange = (double)((monthlySalesAmount - previousMonthSalesAmount) / previousMonthSalesAmount) * 100;
            else if (monthlySalesAmount > 0) monthlyPercentageChange = 100;
            double monthlyProgressBarPercentage = previousMonthSalesAmount > 0 ? Math.Min(100.0, (double)(monthlySalesAmount / previousMonthSalesAmount) * 100.0) : (monthlySalesAmount > 0 ? 100.0 : 0.0);

            var currentYearStart = new DateTime(now.Year, 1, 1);
            var currentYearEnd = currentYearStart.AddYears(1);
            var previousYearStart = currentYearStart.AddYears(-1);

            var (yearlySalesAmount, _) = await GetSalesDataForPeriod("Current Year", currentYearStart, currentYearEnd);
            var (previousYearSalesAmount, _) = await GetSalesDataForPeriod("Previous Year", previousYearStart, currentYearStart);

            var yearlyTrend = "neutral";
            if (yearlySalesAmount > previousYearSalesAmount) yearlyTrend = "up";
            else if (yearlySalesAmount < previousYearSalesAmount) yearlyTrend = "down";

            double yearlyPercentageChange = 0;
            if (previousYearSalesAmount > 0) yearlyPercentageChange = (double)((yearlySalesAmount - previousYearSalesAmount) / previousYearSalesAmount) * 100;
            else if (yearlySalesAmount > 0) yearlyPercentageChange = 100;
            double yearlyProgressBarPercentage = previousYearSalesAmount > 0 ? Math.Min(100.0, (double)(yearlySalesAmount / previousYearSalesAmount) * 100.0) : (yearlySalesAmount > 0 ? 100.0 : 0.0);

            var summary = new
            {
                DailySales = new { Amount = dailySalesAmount, Trend = dailyTrend, PercentageChange = Math.Round(dailyPercentageChange, 2), ProgressBarPercentage = Math.Round(dailyProgressBarPercentage) },
                MonthlySales = new { Amount = monthlySalesAmount, Trend = monthlyTrend, PercentageChange = Math.Round(monthlyPercentageChange, 2), ProgressBarPercentage = Math.Round(monthlyProgressBarPercentage) },
                YearlySales = new { Amount = yearlySalesAmount, Trend = yearlyTrend, PercentageChange = Math.Round(yearlyPercentageChange, 2), ProgressBarPercentage = Math.Round(yearlyProgressBarPercentage) }
            };

            Console.WriteLine($"--- Final Summary Object Sent to Frontend ---");
            Console.WriteLine(JsonSerializer.Serialize(summary, new JsonSerializerOptions { WriteIndented = true }));
            Console.WriteLine($"--- End GetSalesSummary ---");

            return Ok(summary);
        }



        [HttpPost, Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto request)
        {
            if (request == null)
            {
                Console.WriteLine("ERROR (Controller): CreateOrderDto request body is null.");
                return BadRequest(new { message = "Request body cannot be empty." });
            }

            Console.WriteLine($"INFO (Controller): CreateOrder Action START. ClientName from DTO: {request.ClientName}, UserId: {request.UserId}"); 
            var actingUser = await _context.Users.FindAsync(request.UserId);

            if (actingUser == null)
            {
                Console.WriteLine($"ERROR (Controller): User with ID '{request.UserId}' provided in request body not found.");
                return BadRequest(new { message = $"User with ID '{request.UserId}' not found." });
            }

            try
            {
                Order order = await _orderService.CreateOrderAsync(request, actingUser.Id);

                if (order == null)
                {
                    Console.WriteLine($"ERROR (Controller): _orderService.CreateOrderAsync returned null. Request: ClientName='{request.ClientName}', UserId='{request.UserId}'. This indicates a failure within the OrderService that was not thrown as an exception.");
                    return StatusCode(500, new { message = "Order creation failed internally within the service. The order object was null." });
                }

                Console.WriteLine($"INFO (Controller): Service call completed. Order ID: {order.OrderId}.");

                var notificationDto = new OrderCreatedNotificationDto
                {
                    OrderId = order.OrderId,
                    ClientName = order.ClientName ?? "N/A",
                    TotalPrice = order.TotalPrice,
                    Status = order.Status,
                    CreatedAt = order.Created,
                    CreatedByUserName = actingUser.UserName ?? "Unknown User"
                };

                if (_hubContext.Clients == null)
                {
                     Console.WriteLine($"ERROR (Controller): _hubContext.Clients is null before sending notification for order {order.OrderId}.");
                }
                else
                {
                    await _hubContext.Clients.All.SendAsync("ReceiveOrderCreated", notificationDto);
                    Console.WriteLine($"INFO (Controller): Sent SignalR notification for new order {order.OrderId}.");
                }

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

            string oldStatus = orderToUpdate.Status;

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