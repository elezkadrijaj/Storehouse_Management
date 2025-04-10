using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class ProductCreateDto
    {
        [Required]
        public string Name { get; set; }

        [Range(0, double.MaxValue)]
        public double Stock { get; set; }

        public DateTime ExpiryDate { get; set; }

        [Range(0, double.MaxValue)]
        public double Price { get; set; }

        public IFormFile? PhotoFile { get; set; }

        [Required]
        public string SupplierId { get; set; }

        [Required]
        public string CategoryId { get; set; }

        public int? SectionId { get; set; }
    }
}
