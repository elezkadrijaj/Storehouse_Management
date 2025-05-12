using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http; // Required for StatusCodes
using Stripe;
// Specifically import the Stripe.Checkout namespace for its Session and SessionService
using StripeCheckout = Stripe.Checkout;
// Specifically import the Stripe.BillingPortal namespace for its Session and SessionService
using StripeBillingPortal = Stripe.BillingPortal;
using System.Linq; // Required for FirstOrDefault() if you were still using Request.Form directly

namespace Api.Controllers // Or your namespace
{
    [Route("create-portal-session")]
    [ApiController]
    public class PortalApiController : ControllerBase
    {
        [HttpPost]
        // Add [FromForm] attribute to the sessionId parameter
        public ActionResult Create([FromForm] string? sessionId)
        {
            if (string.IsNullOrEmpty(sessionId))
            {
                return BadRequest(new { error = "session_id is required." });
            }

            // Instantiate the correct Stripe Checkout SessionService
            var checkoutSessionService = new StripeCheckout.SessionService();
            StripeCheckout.Session checkoutSession; // Explicitly use Stripe.Checkout.Session

            try
            {
                checkoutSession = checkoutSessionService.Get(sessionId);
            }
            catch (StripeException ex)
            {
                // Consider logging the exception
                // _logger.LogError(ex, "Stripe API error while retrieving checkout session {SessionId}", sessionId);
                return BadRequest(new { error = $"Error retrieving checkout session: {ex.Message}" });
            }

            if (checkoutSession == null) // Good to check for null even if Get usually throws on not found
            {
                return NotFound(new { error = $"Checkout session with ID '{sessionId}' not found." });
            }

            if (string.IsNullOrEmpty(checkoutSession.CustomerId))
            {
                // This can happen if the checkout session didn't result in a customer being created or associated
                // (e.g., payment failed before customer creation, or a guest checkout without customer creation).
                return BadRequest(new { error = "Could not find Customer ID in the checkout session. Ensure the checkout session completed successfully and created/associated a customer." });
            }

            // This is the URL to which your customer will return after
            // they're done managing billing in the Customer Portal.
            var returnUrl = "https://localhost:7204"; ; // Consider making this configurable
            // For testing, if your .NET app runs on HTTPS (e.g., https://localhost:7204),
            // and your success/cancel URLs are also on this app, match the scheme:
            // var returnUrl = "https://localhost:7204";


            var portalSessionOptions = new StripeBillingPortal.SessionCreateOptions
            {
                Customer = checkoutSession.CustomerId,
                ReturnUrl = returnUrl,
            };

            // Instantiate the correct Stripe Billing Portal SessionService
            var portalSessionService = new StripeBillingPortal.SessionService();
            StripeBillingPortal.Session portalSession;

            try
            {
                portalSession = portalSessionService.Create(portalSessionOptions);
            }
            catch (StripeException ex)
            {
                // Consider logging the exception
                // _logger.LogError(ex, "Stripe API error while creating portal session for customer {CustomerId}", checkoutSession.CustomerId);
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = $"Error creating portal session: {ex.Message}" });
            }

            Response.Headers.Append("Location", portalSession.Url);
            return StatusCode(StatusCodes.Status303SeeOther);
        }
    }
}