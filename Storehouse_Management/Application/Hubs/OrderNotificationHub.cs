using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.Hubs
{
    public class OrderNotificationHub : Hub
    {
        // Example of a method a client *could* call if needed (not required for this scenario)
        public async Task JoinGroup(string groupName)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            // Consider logging or returning a confirmation to the client
            // await Clients.Caller.SendAsync("JoinedGroup", groupName);
        }

        public async Task LeaveGroup(string groupName)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
            // Consider logging or returning a confirmation to the client
            // await Clients.Caller.SendAsync("LeftGroup", groupName);
        }
    }
}
