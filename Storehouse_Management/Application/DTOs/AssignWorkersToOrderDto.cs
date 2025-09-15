using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class AssignWorkersToOrderDto
    {
        [Required]
        [MinLength(1, ErrorMessage = "At least one worker must be assigned.")]
        public List<string> WorkerIds { get; set; } = new List<string>();
    }
}
