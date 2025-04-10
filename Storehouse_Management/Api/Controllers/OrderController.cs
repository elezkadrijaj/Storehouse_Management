using Microsoft.AspNetCore.Mvc;
using Infrastructure.Data;
using Core.Entities;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Application.DTOs;
using Application.Services.Products;
using Application.Services.Orders;
using Application.Interfaces;


namespace Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OrdersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ProductService _productService;
        private readonly IOrderService _orderService;

        public OrdersController(AppDbContext context, ProductService productService, IOrderService orderService)
        {
            _context = context;
            _productService = productService;
            _orderService = orderService;
        }

        [HttpPost, Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto request)
        {
            var user = await _context.Users.FindAsync(request.UserId);

            try
            {
                Order order = await _orderService.CreateOrderAsync(request, user.Id);
                return CreatedAtAction(nameof(GetOrder), new { id = order.OrderId }, order);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return StatusCode(500, "Internal Server Error");
            }
        }

        [HttpGet("{id}"), Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<ActionResult<Order>> GetOrder(int id)
        {
            var order = await _orderService.GetOrderAsync(id);

            if (order == null)
            {
                return NotFound();
            }

            return Ok(order);
        }

        [HttpPut("{id}/status"), Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateOrderDto request)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var order = await _context.Orders.FindAsync(id);

            if (order == null)
            {
                return NotFound();
            }

            if (!await _orderService.CanUpdateStatusAsync(order, request.Status, userId))
            {
                return Forbid();
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

            return NoContent();
        }
    }
}