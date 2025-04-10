using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Core.Entities
{
    public class Section
    {
        public int SectionId { get; set; }
        public string Name { get; set; }

        public int? StorehousesId { get; set; }
        public Storehouse? Storehouses { get; set; }
    }
}
