using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Concurrent; // For UserConnectionManager
using System.Collections.Generic;    // For UserConnectionManager
using System.Linq;                 // For UserConnectionManager
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;

namespace Application.Hubs
{

    public class UserConnectionManager
    {
        private static readonly ConcurrentDictionary<string, HashSet<string>> _userConnections =
            new ConcurrentDictionary<string, HashSet<string>>();

        private readonly ILogger<UserConnectionManager> _logger;

        public UserConnectionManager(ILogger<UserConnectionManager> logger)
        {
            _logger = logger;
        }

        public void AddConnection(string userId, string connectionId)
        {
            var connections = _userConnections.GetOrAdd(userId, _ => new HashSet<string>());

            lock (connections)
            {
                connections.Add(connectionId);
            }
            _logger.LogDebug("--> Connection Added: UserId={UserId}, ConnectionId={ConnectionId}. Total connections for user: {Count}",
                userId, connectionId, connections.Count);
        }
        public (bool found, string? userId) RemoveConnection(string connectionId)
        {
            string? foundUserId = null;
            bool removed = false;

            foreach (var userEntry in _userConnections)
            {
                lock (userEntry.Value) 
                {
                    if (userEntry.Value.Contains(connectionId))
                    {
                        foundUserId = userEntry.Key;
                        removed = userEntry.Value.Remove(connectionId);

                        _logger.LogDebug("--> Connection Removed: UserId={UserId}, ConnectionId={ConnectionId}. Result: {Removed}",
                            foundUserId, connectionId, removed);

                        if (userEntry.Value.Count == 0)
                        {
                            _logger.LogDebug("--- Last connection removed for UserId={UserId}. Removing user entry.", foundUserId);
                            _userConnections.TryRemove(foundUserId, out _);
                        }
                        break; 
                    }
                }
            }

            if (!removed)
            {
                _logger.LogWarning("--> RemoveConnection: ConnectionId {ConnectionId} not found in any user mapping.", connectionId);
            }

            return (removed, foundUserId);
        }

        public HashSet<string>? GetConnections(string userId)
        {
            return _userConnections.TryGetValue(userId, out var connections) ? connections : null;
        }
    }
}