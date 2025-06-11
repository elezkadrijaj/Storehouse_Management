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
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly UserConnectionManager _connectionManager;
        private readonly ILogger<ChatHub> _logger;

        private string GetCompanyGroupName(string companyId) => $"Company-{companyId}";

        public ChatHub(
            UserManager<ApplicationUser> userManager,
            UserConnectionManager connectionManager,
            ILogger<ChatHub> logger)
        {
            _userManager = userManager;
            _connectionManager = connectionManager;
            _logger = logger;
        }

        public override async Task OnConnectedAsync()
        {
            var userId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            var companyId = Context.User?.FindFirstValue("CompanyId"); 
            var userName = Context.User?.FindFirstValue(ClaimTypes.Name) ?? "Unknown User";

            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(companyId))
            {
                _logger.LogWarning("--> Connection ABORTED: Missing required claims. UserId: '{UserId}', CompanyId: '{CompanyId}'. ConnectionId: {ConnectionId}",
                    userId ?? "N/A", companyId ?? "N/A", Context.ConnectionId);
                Context.Abort();
                await base.OnConnectedAsync();
                return;
            }

            var companyGroup = GetCompanyGroupName(companyId);

            try
            {
                _connectionManager.AddConnection(userId, companyId, Context.ConnectionId);
                await Groups.AddToGroupAsync(Context.ConnectionId, companyGroup);

                _logger.LogInformation("--> User Connected: UserName='{UserName}', UserId='{UserId}', CompanyId='{CompanyId}'. Added to group '{GroupName}'.",
                    userName, userId, companyId, companyGroup);

                await Clients.Caller.SendAsync("ConnectionConfirmed",
                    $"Welcome {userName}! You are in the company chat.",
                    Context.ConnectionId,
                    userId
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "--> ERROR in OnConnectedAsync for User '{UserName}' ({UserId}).", userName, userId);
                Context.Abort();
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var connectionId = Context.ConnectionId;
            var removalResult = _connectionManager.RemoveConnection(connectionId);

            if (removalResult.found && removalResult.companyId != null)
            {
                var companyGroup = GetCompanyGroupName(removalResult.companyId);
                await Groups.RemoveFromGroupAsync(connectionId, companyGroup);
                _logger.LogInformation("--> User Disconnected: UserId='{UserId}', CompanyId='{CompanyId}', ConnectionId='{ConnectionId}'. Removed from group '{GroupName}'. Reason: {ExceptionMessage}",
                    removalResult.userId, removalResult.companyId, connectionId, companyGroup, exception?.Message ?? "Normal disconnect");
            }
            else
            {
                _logger.LogWarning("--> Disconnected user's mapping not found for ConnectionId {ConnectionId}.", connectionId);
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task SendMessage(string message)
        {
            var senderUserId = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
            var senderCompanyId = Context.User?.FindFirstValue("CompanyId");
            var senderUserName = Context.User?.FindFirstValue(ClaimTypes.Name) ?? "Unknown Sender";

            if (string.IsNullOrEmpty(senderUserId) || string.IsNullOrEmpty(senderCompanyId))
            {
                _logger.LogError("--> SendMessage FAILED: Sender is missing required claims. ConnectionId: {ConnectionId}", Context.ConnectionId);
                await Clients.Caller.SendAsync("ReceiveError", "Internal server error: Cannot identify sender's company.");
                return;
            }

            if (string.IsNullOrWhiteSpace(message))
            {
                await Clients.Caller.SendAsync("ReceiveError", "Cannot send an empty message.");
                return;
            }

            const int MaxMessageLength = 500;
            if (message.Length > MaxMessageLength)
            {
                message = message.Substring(0, MaxMessageLength);
            }

            var companyGroup = GetCompanyGroupName(senderCompanyId);
            var timestamp = DateTime.UtcNow;

            try
            {
                _logger.LogInformation("--> Broadcasting message to group '{GroupName}' from {SenderUserName} ({SenderUserId}).",
                    companyGroup, senderUserName, senderUserId);

                await Clients.Group(companyGroup).SendAsync("ReceiveMessage",
                    senderUserId,
                    senderUserName,
                    message,
                    timestamp);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "--> ERROR broadcasting message from {SenderUserName} to group {GroupName}.",
                   senderUserName, companyGroup);
                await Clients.Caller.SendAsync("ReceiveError", "Failed to send message due to a server error.");
            }
        }
    }
}