using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class LoginResultDTO
    {
        public bool IsSuccess { get; set; }
        public string? ErrorMessage { get; set; }
        public string? Token { get; set; }

        public static LoginResultDTO Success(string token)
        {
            return new LoginResultDTO { IsSuccess = true, Token = token };
        }

        public static LoginResultDTO Failure(string errorMessage)
        {
            return new LoginResultDTO { IsSuccess = false, ErrorMessage = errorMessage };
        }
    }
}
