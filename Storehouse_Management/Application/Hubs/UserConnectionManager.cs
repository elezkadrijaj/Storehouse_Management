using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;

namespace Application.Hubs
{
    public class UserConnectionManager
    {

        private static readonly ConcurrentDictionary<string, (string UserId, string CompanyId)> _connectionToUserMap = new();

        private static readonly ConcurrentDictionary<string, HashSet<string>> _userToConnectionsMap = new();

        private readonly ILogger<UserConnectionManager> _logger;

        public UserConnectionManager(ILogger<UserConnectionManager> logger)
        {
            _logger = logger;
        }

        public void AddConnection(string userId, string companyId, string connectionId)
        {

            _connectionToUserMap[connectionId] = (userId, companyId);

            var userConnections = _userToConnectionsMap.GetOrAdd(userId, _ => new HashSet<string>());
            lock (userConnections)
            {
                userConnections.Add(connectionId);
            }

            _logger.LogDebug("--> Connection Added: UserId={UserId}, CompanyId={CompanyId}, ConnectionId={ConnectionId}. Total connections for user: {Count}",
                userId, companyId, connectionId, userConnections.Count);
        }

        public (bool found, string? userId, string? companyId) RemoveConnection(string connectionId)
        {
            if (_connectionToUserMap.TryRemove(connectionId, out var userInfo))
            {
                if (_userToConnectionsMap.TryGetValue(userInfo.UserId, out var userConnections))
                {
                    lock (userConnections)
                    {
                        userConnections.Remove(connectionId);
                        if (userConnections.Count == 0)
                        {
                            _userToConnectionsMap.TryRemove(userInfo.UserId, out _);
                            _logger.LogDebug("--- Last connection removed for UserId={UserId}. Removing user entry.", userInfo.UserId);
                        }
                    }
                }

                _logger.LogDebug("--> Connection Removed: UserId={UserId}, CompanyId={CompanyId}, ConnectionId={ConnectionId}.",
                    userInfo.UserId, userInfo.CompanyId, connectionId);

                return (true, userInfo.UserId, userInfo.CompanyId);
            }

            _logger.LogWarning("--> RemoveConnection: ConnectionId {ConnectionId} not found in mapping.", connectionId);
            return (false, null, null);
        }

        public HashSet<string>? GetConnections(string userId)
        {
            return _userToConnectionsMap.TryGetValue(userId, out var connections) ? connections : null;
        }
    }
}