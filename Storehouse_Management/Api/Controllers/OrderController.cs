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


namespace Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OrdersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IOrderService _orderService;

        public OrdersController(AppDbContext context,IOrderService orderService)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _orderService = orderService ?? throw new ArgumentNullException(nameof(orderService));
        }

        [HttpPost, Authorize(Policy = "StorehouseAccessPolicy")]
        public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto request)
        {
            Console.WriteLine($"INFO (Controller): CreateOrder Action START. ClientName from DTO: {request?.ClientName}");
            var actingUser = await _context.Users.FindAsync(request.UserId);

            if (actingUser == null)
            {
                Console.WriteLine($"ERROR (Controller): User with ID '{request.UserId}' provided in request body not found.");
                return BadRequest(new { message = $"User with ID '{request.UserId}' not found." });
            }

            try
            {
                Order order = await _orderService.CreateOrderAsync(request, actingUser.Id);
                Console.WriteLine($"INFO (Controller): Service call completed. Order ID: {order.OrderId}.");
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
    }
}