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
using QuestPDF.Fluent;
using Application.Services.Orders;

namespace Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = "WorkerAccessPolicy")]
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

        [HttpGet("latest")]
        public async Task<ActionResult<IEnumerable<LatestOrderDto>>> GetLatestOrders([FromQuery] int count = 5)
        {
            var (_, companyId) = await GetCurrentUserCompanyInfoAsync();
            if (companyId == null)
            {
                return Forbid("User is not associated with a company.");
            }

            if (count <= 0) count = 5;
            if (count > 20) count = 20;

            var latestOrders = await _context.Orders
                .Where(o => o.CompanyId == companyId.Value)
                .OrderByDescending(o => o.Created)
                .Take(count)
                .Select(o => new LatestOrderDto
                {
                    OrderId = o.OrderId,
                    ClientName = o.ClientName ?? "N/A",
                    TotalPrice = o.TotalPrice,
                    Status = o.Status,
                    Created = o.Created
                })
                .ToListAsync();

            return Ok(latestOrders);
        }

        private async Task<(string UserId, int? CompanyId)> GetCurrentUserCompanyInfoAsync()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return (null, null);
            }

            var user = await _context.Users
                .AsNoTracking()
                .Select(u => new { u.Id, u.CompaniesId })
                .FirstOrDefaultAsync(u => u.Id == userId);

            return (userId, user?.CompaniesId);
        }

        private async Task<(decimal SalesAmount, int OrderCount)> GetSalesDataForPeriod(DateTime startDate, DateTime endDate, int companyId)
        {
            var ordersInPeriod = await _context.Orders
                .Where(o => o.CompanyId == companyId &&
                             o.Created >= startDate && o.Created < endDate &&
                             _relevantSalesStatuses.Contains(o.Status))
                .ToListAsync();

            decimal totalSales = ordersInPeriod.Sum(o => o.TotalPrice);
            return (totalSales, ordersInPeriod.Count);
        }

        [HttpGet("sales-graph-data/daily-last-30-days")]
        public async Task<ActionResult<IEnumerable<SalesDataPointDto>>> GetDailySalesForLast30Days()
        {
            var (_, companyId) = await GetCurrentUserCompanyInfoAsync();
            if (companyId == null)
            {
                return Forbid("User is not associated with a company.");
            }

            var today = DateTime.UtcNow.Date;
            var startDate = today.AddDays(-29);

            var allDatesInRange = Enumerable.Range(0, 30)
                .Select(offset => startDate.AddDays(offset));

            var salesData = await _context.Orders
                .Where(o => o.CompanyId == companyId.Value &&
                             _relevantSalesStatuses.Contains(o.Status) &&
                             o.Created >= startDate && o.Created < today.AddDays(1))
                .GroupBy(o => o.Created.Date)
                .Select(g => new { Date = g.Key, TotalSales = g.Sum(o => o.TotalPrice) })
                .ToListAsync();

            var graphData = allDatesInRange
                .Select(date => new SalesDataPointDto
                {
                    Label = date.ToString("yyyy-MM-dd"),
                    Value = salesData.FirstOrDefault(s => s.Date == date)?.TotalSales ?? 0m
                })
                .OrderBy(d => d.Label)
                .ToList();

            return Ok(graphData);
        }

        [HttpGet("sales-summary")]
        public async Task<IActionResult> GetSalesSummary()
        {
            var (_, companyId) = await GetCurrentUserCompanyInfoAsync();
            if (companyId == null)
            {
                return Forbid("User is not associated with a company.");
            }

            var now = DateTime.UtcNow;

            var todayStart = now.Date;
            var (dailySalesAmount, _) = await GetSalesDataForPeriod(todayStart, todayStart.AddDays(1), companyId.Value);
            var (yesterdaySalesAmount, _) = await GetSalesDataForPeriod(todayStart.AddDays(-1), todayStart, companyId.Value);

            var currentMonthStart = new DateTime(now.Year, now.Month, 1);
            var (monthlySalesAmount, _) = await GetSalesDataForPeriod(currentMonthStart, currentMonthStart.AddMonths(1), companyId.Value);
            var (previousMonthSalesAmount, _) = await GetSalesDataForPeriod(currentMonthStart.AddMonths(-1), currentMonthStart, companyId.Value);

            var currentYearStart = new DateTime(now.Year, 1, 1);
            var (yearlySalesAmount, _) = await GetSalesDataForPeriod(currentYearStart, currentYearStart.AddYears(1), companyId.Value);
            var (previousYearSalesAmount, _) = await GetSalesDataForPeriod(currentYearStart.AddYears(-1), currentYearStart, companyId.Value);

            Func<decimal, decimal, object> calculateMetrics = (current, previous) =>
            {
                var trend = current > previous ? "up" : (current < previous ? "down" : "neutral");
                double percentageChange = previous > 0 ? (double)((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
                double progressBar = previous > 0 ? Math.Min(100.0, (double)(current / previous) * 100.0) : (current > 0 ? 100.0 : 0.0);

                return new
                {
                    Amount = current,
                    Trend = trend,
                    PercentageChange = Math.Round(percentageChange, 2),
                    ProgressBarPercentage = Math.Round(progressBar)
                };
            };

            var summary = new
            {
                DailySales = calculateMetrics(dailySalesAmount, yesterdaySalesAmount),
                MonthlySales = calculateMetrics(monthlySalesAmount, previousMonthSalesAmount),
                YearlySales = calculateMetrics(yearlySalesAmount, previousYearSalesAmount)
            };

            return Ok(summary);
        }

        [HttpPost, Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto request)
        {
            var actingUserIdFromToken = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(actingUserIdFromToken))
            {
                return Unauthorized(new { message = "User identity not found in token." });
            }

            try
            {
                Order order = await _orderService.CreateOrderAsync(request, actingUserIdFromToken);

                var actingUserForNotification = await _context.Users.FindAsync(actingUserIdFromToken);

                var notificationDto = new OrderCreatedNotificationDto
                {
                    OrderId = order.OrderId,
                    ClientName = order.ClientName ?? "N/A",
                    TotalPrice = order.TotalPrice,
                    Status = order.Status,
                    CreatedAt = order.Created,
                    CreatedByUserName = actingUserForNotification?.UserName ?? "Unknown User"
                };
                await _hubContext.Clients.All.SendAsync("ReceiveOrderCreated", notificationDto);

                return CreatedAtAction(nameof(GetOrder), new { id = order.OrderId }, order);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (DbUpdateException dbEx)
            {
                return StatusCode(500, new { message = "A database error occurred while saving the order.", detail = dbEx.InnerException?.Message ?? dbEx.Message });
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(500, new { message = ex.Message, detail = "An operation failed during order processing. Order may be partially complete." });
            }
            catch (Exception)
            {
                return StatusCode(500, new { message = "An internal server error occurred while creating the order." });
            }
        }

        [HttpGet, Authorize(Policy = "WorkerAccessPolicy")]
        public async Task<ActionResult<IEnumerable<Order>>> GetOrders()
        {
            var currentUserIdFromToken = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserIdFromToken))
            {
                return Unauthorized(new { message = "User identity not found." });
            }

            var currentUser = await _context.Users
                                        .AsNoTracking()
                                        .FirstOrDefaultAsync(u => u.Id == currentUserIdFromToken);

            if (currentUser == null)
            {
                return NotFound(new { message = "User profile not found." });
            }

            if (currentUser.CompaniesId == null)
            {
                return Ok(Enumerable.Empty<Order>());
            }

            var userCompanyId = currentUser.CompaniesId.Value;

            var orders = await _context.Orders
                                    .Where(o => o.CompanyId == userCompanyId)
                                    .Include(o => o.AppUsers)
                                    .Include(o => o.Company)
                                    .OrderByDescending(o => o.Created)
                                    .ToListAsync();

            return Ok(orders);
        }

        [HttpGet("{id}"), Authorize(Policy = "WorkerAccessPolicy")]
        public async Task<ActionResult<Order>> GetOrder(int id)
        {
            var order = await _orderService.GetOrderAsync(id);
            if (order == null)
            {
                return NotFound(new { message = $"Order with ID {id} not found." });
            }
            return Ok(order);
        }

        [HttpPost("{id}/assign-workers"), Authorize(Policy = "StorehouseAccessPolicy")]
        [Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> AssignWorkers(string id, [FromBody] AssignWorkersToOrderDto request)
        {
            var actingUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(actingUserId))
            {
                return Unauthorized("User identity not found.");
            }

            try
            {
                await _orderService.AssignWorkersToOrderAsync(id, request.WorkerIds, actingUserId);
                return Ok(new { message = "Workers assigned successfully." });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return Forbid(ex.Message);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception)
            {
                return StatusCode(500, new { message = "An internal server error occurred while assigning workers." });
            }
        }

        [HttpGet("my-assigned-orders")]
        [Authorize(Policy = "WorkerAccessPolicy")]
        public async Task<ActionResult<IEnumerable<Order>>> GetMyAssignedOrders()
        {
            var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(currentUserId))
            {
                return Unauthorized(new { message = "User identity not found in token." });
            }

            var assignedOrders = await _orderService.GetOrdersAssignedToWorkerAsync(currentUserId);

            return Ok(assignedOrders);
        }

        [HttpPut("{id}/status"), Authorize(Policy = "WorkerAccessPolicy")]
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

                return NoContent();
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(new { message = "The order was modified by another user. Please refresh and try again." });
            }
            catch (Exception)
            {
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
                return NotFound(new { message = $"Order with ID {orderId} not found." });
            }

            var companyInfo = await _context.Companies.FirstOrDefaultAsync();

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
                var invoiceDocument = new InvoiceDocument(orderWithItemsDto, companyInfo);

                byte[] pdfBytes = invoiceDocument.GeneratePdf();

                string fileName = $"Invoice_{sanitizedClientName}_{orderId}_{DateTime.UtcNow:yyyyMMddHHmmss}.pdf";

                return File(pdfBytes, "application/pdf", fileName);
            }
            catch (Exception)
            {
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