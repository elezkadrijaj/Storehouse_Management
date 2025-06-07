//using Microsoft.AspNetCore.Http;
//using Microsoft.AspNetCore.Mvc;
//using Stripe;

//namespace Api.Controllers
//{
//    [Route("webhook")]
//    [ApiController]
//    public class WebhookController : ControllerBase // Use ControllerBase for APIs
//    {
//        private readonly string _endpointSecret;
//        private readonly ILogger<WebhookController> _logger;

//        // Inject configuration and logger
//        public WebhookController(IConfiguration configuration, ILogger<WebhookController> logger)
//        {
//            _logger = logger;
//            // Get webhook secret from configuration
//            // Example in appsettings.json: "Stripe": { "WebhookSecret": "whsec_..." }
//            _endpointSecret = configuration["Stripe:WebhookSecret"];

//            if (string.IsNullOrEmpty(_endpointSecret))
//            {
//                _logger.LogWarning("Stripe Webhook Secret not configured. Please set 'Stripe:WebhookSecret'. Using placeholder.");
//                // Fallback for local testing if not configured, but strongly advise against for production
//                _endpointSecret = "whsec_12345"; // REPLACE THIS with your actual test secret or configure it
//            }
//        }

//        [HttpPost]
//        public async Task<IActionResult> Index()
//        {
//            var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
//            try
//            {
//                var stripeEvent = EventUtility.ConstructEvent(json,
//                        Request.Headers["Stripe-Signature"], _endpointSecret);

//                // Handle the event
//                _logger.LogInformation("Received Stripe event: {EventType}", stripeEvent.Type);

//                switch (stripeEvent.Type)
//                {
//                    case EventTypes.CustomerSubscriptionCreated:
//                        var createdSubscription = stripeEvent.Data.Object as Subscription;
//                        _logger.LogInformation("A subscription was created: {SubscriptionId}", createdSubscription?.Id);
//                        // handleSubscriptionCreated(createdSubscription);
//                        break;
//                    case EventTypes.CustomerSubscriptionUpdated:
//                        var updatedSubscription = stripeEvent.Data.Object as Subscription;
//                        _logger.LogInformation("A subscription was updated: {SubscriptionId}", updatedSubscription?.Id);
//                        // handleSubscriptionUpdated(updatedSubscription);
//                        break;
//                    case EventTypes.CustomerSubscriptionDeleted:
//                        var deletedSubscription = stripeEvent.Data.Object as Subscription;
//                        _logger.LogInformation("A subscription was canceled: {SubscriptionId}", deletedSubscription?.Id);
//                        // handleSubscriptionCanceled(deletedSubscription);
//                        break;
//                    case EventTypes.CustomerSubscriptionTrialWillEnd:
//                        var trialEndingSubscription = stripeEvent.Data.Object as Subscription;
//                        _logger.LogInformation("A subscription trial will end: {SubscriptionId}", trialEndingSubscription?.Id);
//                        // handleSubscriptionTrialWillEnd(trialEndingSubscription);
//                        break;
//                    // Note: ActiveEntitlementSummaryUpdated is part of Stripe Entitlements (Beta)
//                    // Ensure you are using this feature if you handle this event.
//                    case "active_entitlement_summary.updated": // Use the string value if EventTypes doesn't have it
//                        var summary = stripeEvent.Data.Object as Stripe.Entitlements.ActiveEntitlementSummary; // Requires Stripe.net >= 43.x for this specific type
//                        _logger.LogInformation("Active entitlement summary updated for customer: {Customer}", summary?.Customer);
//                        // handleEntitlementUpdated(summary);
//                        break;
//                    // Add other event types as needed
//                    // Example: PaymentIntent succeeded
//                    case EventTypes.PaymentIntentSucceeded:
//                        var paymentIntent = stripeEvent.Data.Object as PaymentIntent;
//                        _logger.LogInformation("PaymentIntent was successful for {Amount}!", paymentIntent?.Amount);
//                        // Handle successful payment intent
//                        break;
//                    default:
//                        _logger.LogWarning("Unhandled event type: {EventType}", stripeEvent.Type);
//                        break;
//                }

//                return Ok();
//            }
//            catch (StripeException e)
//            {
//                _logger.LogError(e, "Stripe webhook error");
//                return BadRequest(new { error = e.Message });
//            }
//            catch (Exception e)
//            {
//                _logger.LogError(e, "Webhook processing error");
//                return StatusCode(500, new { error = "Internal server error" });
//            }
//        }
//    }
//}