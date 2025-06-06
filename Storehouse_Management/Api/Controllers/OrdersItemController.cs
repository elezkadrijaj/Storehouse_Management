﻿using Microsoft.AspNetCore.Mvc;
using Infrastructure.Data; // Your DbContext location
using Core.Entities; // Your entity location
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;

[ApiController]
[Route("api/[controller]")]
public class OrderItemsController : ControllerBase
{
    private readonly AppDbContext _context;

    public OrderItemsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet, Authorize(Policy = "StorehouseAccessPolicy")]
    public async Task<ActionResult<IEnumerable<OrderItem>>> GetOrderItems()
    {
        return await _context.OrderItems.ToListAsync();
    }

    [HttpGet("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
    public async Task<ActionResult<OrderItem>> GetOrderItem(int id)
    {
        var orderItem = await _context.OrderItems.FindAsync(id);

        if (orderItem == null)
        {
            return NotFound();
        }

        return orderItem;
    }

    [HttpPost, Authorize(Policy = "StorehouseAccessPolicy")]
    public async Task<ActionResult<OrderItem>> PostOrderItem(OrderItem orderItem)
    {
        _context.OrderItems.Add(orderItem);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetOrderItem), new { id = orderItem.OrderItemId }, orderItem);
    }

    [HttpPut("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
    public async Task<IActionResult> PutOrderItem(int id, OrderItem orderItem)
    {
        if (id != orderItem.OrderItemId)
        {
            return BadRequest();
        }

        _context.Entry(orderItem).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!OrderItemExists(id))
            {
                return NotFound();
            }
            else
            {
                throw;
            }
        }

        return NoContent();
    }

    [HttpDelete("{id}"), Authorize(Policy = "StorehouseAccessPolicy")]
    public async Task<IActionResult> DeleteOrderItem(int id)
    {
        var orderItem = await _context.OrderItems.FindAsync(id);
        if (orderItem == null)
        {
            return NotFound();
        }

        _context.OrderItems.Remove(orderItem);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private bool OrderItemExists(int id)
    {
        return _context.OrderItems.Any(e => e.OrderItemId == id);
    }
}