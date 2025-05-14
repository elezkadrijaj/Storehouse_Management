using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Identity;
using Core.Entities;


namespace Application.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        // Dependencies injected via constructor
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly UserConnectionManager _connectionManager;
        private readonly ILogger<ChatHub> _logger;

        private const string GroupName = "GeneralChat";

        public ChatHub(
            UserManager<ApplicationUser> userManager,
            UserConnectionManager connectionManager, 
            ILogger<ChatHub> logger)
        {
            _userManager = userManager ?? throw new ArgumentNullException(nameof(userManager));
            _connectionManager = connectionManager ?? throw new ArgumentNullException(nameof(connectionManager));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public override async Task OnConnectedAsync()
{
    var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
    var userName = Context.User?.FindFirstValue(ClaimTypes.Name)
                          ?? Context.User?.Identity?.Name
                          ?? "Unknown User";

    if (string.IsNullOrEmpty(userId))
    {
        _logger.LogWarning("--> Connection ABORTED in OnConnectedAsync: NameIdentifier claim missing or empty for ConnectionId {ConnectionId}. Check authentication configuration.", Context.ConnectionId);
        Context.Abort();
        // It's generally better to await base.OnConnectedAsync() even if aborting, or handle the exception it might throw.
        // However, for simplicity here, ensure the flow stops.
        await base.OnConnectedAsync(); // Call base method
        return;
    }

    try
    {
        _connectionManager.AddConnection(userId, Context.ConnectionId);
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName);

        _logger.LogInformation("--> User Connected: UserName='{UserName}', UserId='{UserId}', ConnectionId='{ConnectionId}'. Added to group '{GroupName}'.",
            userName, userId, Context.ConnectionId, GroupName);

        // --- CORRECTED LINE ---
        // Send the welcome message, the hub's connection ID, AND the authenticated User's ID
        await Clients.Caller.SendAsync("ConnectionConfirmed",
            $"Welcome {userName}!",     // welcomeMessage (arg1)
            Context.ConnectionId,       // hubConnectionId (arg2)
            userId                      // userIdFromHub (arg3) <<<< ADDED THIS
        );
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "--> ERROR in OnConnectedAsync for User '{UserName}' ({UserId}), ConnectionId {ConnectionId}.",
            userName, userId ?? "N/A", Context.ConnectionId); // Ensure userId is not null for logging if it reached here
        Context.Abort(); // Abort connection on error
    }

    await base.OnConnectedAsync(); // Call base method
}

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var connectionId = Context.ConnectionId;
            string logUserName = "User (Context Lost)"; 
            string logUserId = "unknown";

            try
            {
                var removalResult = _connectionManager.RemoveConnection(connectionId);
                await Groups.RemoveFromGroupAsync(connectionId, GroupName);

                logUserId = removalResult.userId ?? Context.User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown";

                if (removalResult.found && removalResult.userId != null)
                {
                    logUserName = Context.User?.FindFirstValue(ClaimTypes.Name) ?? Context.User?.Identity?.Name ?? "User (Name Missing)";
                }
                else if (!removalResult.found)
                {
                    logUserName = "User (Mapping Not Found)";
                }

                _logger.LogInformation("--> User Disconnected: UserName='{UserName}', UserId='{UserId}', ConnectionId='{ConnectionId}'. Removed from group '{GroupName}'. Reason: {ExceptionMessage}",
                    logUserName, logUserId, connectionId, GroupName, exception?.Message ?? "Normal disconnect");

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "--> ERROR in OnDisconnectedAsync for ConnectionId {ConnectionId}. Potential UserId: {UserId}",
                   connectionId, logUserId);
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task SendMessageToGroup(string message)
        {
            var senderUserId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            var senderUserName = Context.User?.FindFirstValue(ClaimTypes.Name)
                                  ?? Context.User?.Identity?.Name 
                                  ?? "Unknown Sender";            

            if (string.IsNullOrEmpty(senderUserId))
            {
                _logger.LogError("--> SendMessageToGroup FAILED: Sender User ID (NameIdentifier claim) is missing despite [Authorize]. ConnectionId: {ConnectionId}", Context.ConnectionId);

                await Clients.Caller.SendAsync("ReceiveError", "Internal server error: Cannot identify sender.");
                return;
            }

            if (string.IsNullOrWhiteSpace(message))
            {
                _logger.LogWarning("--> SendMessageToGroup BLOCKED: Empty message attempt from {SenderUserName} ({SenderUserId}).", senderUserName, senderUserId);
                await Clients.Caller.SendAsync("ReceiveError", "Cannot send an empty message.");
                return;
            }

            const int MaxMessageLength = 500;
            if (message.Length > MaxMessageLength)
            {
                var originalLength = message.Length;
                message = message.Substring(0, MaxMessageLength) + "... (truncated)";
                _logger.LogWarning("--> Message truncated for {SenderUserName} ({SenderUserId}). Original length: {Length}. Truncated to: {MaxLength}",
                    senderUserName, senderUserId, originalLength, MaxMessageLength);
                await Clients.Caller.SendAsync("ReceiveWarning", $"Your message was too long and truncated to {MaxMessageLength} characters.");
            }

            var timestamp = DateTime.UtcNow; 

            try
            {
                _logger.LogInformation("--> Broadcasting message to group '{GroupName}' from {SenderUserName} ({SenderUserId}): {Message}",
                    GroupName, senderUserName, senderUserId, message);

                await Clients.Group(GroupName).SendAsync("ReceiveGroupMessage",
                    senderUserId,      
                    senderUserName,     
                    message,           
                    timestamp);         
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "--> ERROR broadcasting message from {SenderUserName} ({SenderUserId}) to group {GroupName}.",
                   senderUserName, senderUserId, GroupName);
                await Clients.Caller.SendAsync("ReceiveError", "Failed to send message due to a server error.");
            }
        }
    }
}