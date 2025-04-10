using Application.Services.Products;
using Core.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SuppliersController : ControllerBase
    {
        private readonly SupplierService _supplierService;

        public SuppliersController(SupplierService supplierService)
        {
            _supplierService = supplierService;
        }

        [HttpGet, Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<ActionResult<List<Supplier>>> GetSuppliers()
        {
            var suppliers = await _supplierService.GetAllSuppliersAsync();
            return Ok(suppliers);
        }

        [HttpGet("{id}"), Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<ActionResult<Supplier>> GetSupplier(string id)
        {
            var supplier = await _supplierService.GetSupplierByIdAsync(id);
            if (supplier == null)
            {
                return NotFound();
            }
            return Ok(supplier);
        }

        [HttpPost, Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<ActionResult<Supplier>> CreateSupplier(Supplier supplier)
        {
            await _supplierService.CreateSupplierAsync(supplier);
            return CreatedAtAction(nameof(GetSupplier), new { id = supplier.SupplierId }, supplier);
        }

        [HttpPut("{id}"), Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<IActionResult> UpdateSupplier(string id, Supplier supplier)
        {
            if (id != supplier.SupplierId)
            {
                return BadRequest();
            }

            await _supplierService.UpdateSupplierAsync(id, supplier);
            return NoContent();
        }

        [HttpDelete("{id}"), Authorize(Policy = "StorehouseWorkerPolicy")]
        public async Task<IActionResult> DeleteSupplier(string id)
        {
            await _supplierService.DeleteSupplierAsync(id);
            return NoContent();
        }
    }
}
