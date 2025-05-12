// Add this line if it's missing
using Microsoft.AspNetCore.Mvc;
// Required for StatusCodes class
using Microsoft.AspNetCore.Http;

// Other using directives you might have
using Stripe;
using Stripe.Checkout;
using System.Collections.Generic;
using System.Linq; // If you're using FirstOrDefault() for form data

namespace Api.Controllers // Or your namespace, e.g., ServerApp.Controllers
{
    [Route("create-checkout-session")]
    [ApiController]
    public class CheckoutApiController : ControllerBase
    {
        [HttpPost]
        // Add [FromForm] attribute to the parameter
        public ActionResult Create([FromForm] string? lookupKey)
        {
            var domain = "https://localhost:7204";
            // Now lookupKey is directly available from the parameter binding
            if (string.IsNullOrEmpty(lookupKey))
            {
                return BadRequest(new { error = "lookup_key is required." });
            }

            var priceOptions = new PriceListOptions
            {
                LookupKeys = new List<string> { lookupKey }
            };
            var priceService = new PriceService();
            StripeList<Price> prices;

            try
            {
                prices = priceService.List(priceOptions);
            }
            catch (StripeException ex)
            {
                // Log the error
                // _logger.LogError(ex, "Stripe API error while listing prices for lookup_key: {LookupKey}", lookupKey);
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = $"Error fetching prices: {ex.Message}" });
            }


            if (prices.Data == null || !prices.Data.Any())
            {
                return NotFound(new { error = $"Price with lookup_key '{lookupKey}' not found." });
            }

            var options = new SessionCreateOptions
            {
                LineItems = new List<SessionLineItemOptions>
                {
                  new SessionLineItemOptions
                  {
                    Price = prices.Data[0].Id,
                    Quantity = 1,
                  },
                },
                Mode = "subscription",
                SuccessUrl = domain + "/success.html?session_id={CHECKOUT_SESSION_ID}",
                CancelUrl = domain + "/cancel.html",
            };
            var service = new SessionService();
            Session session;

            try
            {
                session = service.Create(options);
            }
            catch (StripeException ex)
            {
                // Log the error
                // _logger.LogError(ex, "Stripe API error while creating checkout session for lookup_key: {LookupKey}", lookupKey);
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = $"Error creating checkout session: {ex.Message}" });
            }

            Response.Headers.Append("Location", session.Url);
            return StatusCode(StatusCodes.Status303SeeOther);
        }
    }
}