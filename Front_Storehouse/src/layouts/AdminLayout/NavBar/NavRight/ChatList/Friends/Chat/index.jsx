import React, { useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Card, FormControl, InputGroup, Spinner } from 'react-bootstrap';
import * as signalR from '@microsoft/signalr';

const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) { // Check for invalid date
            console.error("Error formatting timestamp: Invalid date object from input:", timestamp);
            return 'Invalid date';
        }
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        console.error("Error formatting timestamp:", e, "Input:", timestamp);
        return 'Invalid date';
    }
};

const SESSION_STORAGE_KEYS = {
  TOKEN: 'authToken',
  USER_ID: 'userId',     // Should store the User's unique ID (GUID)
  USER_NAME: 'userName', // Should store the User's display name (e.g., "Edi")
};

const CHAT_HUB_URL = 'https://localhost:7204/chathub'; // Ensure this is your correct Hub URL

const Chat = ({ user, chatOpen, closed }) => {
    const [connection, setConnection] = useState(null);
    const [connectionState, setConnectionState] = useState(signalR.HubConnectionState.Disconnected);
    const [messageInput, setMessageInput] = useState('');
    const [messageHistory, setMessageHistory] = useState([]);
    const [error, setError] = useState(null);
    const messagesContainerRef = useRef(null);
    const messagesEndRef = useRef(null);

    const [confirmedUserId, setConfirmedUserId] = useState(null);     // User's GUID confirmed by Hub
    const [confirmedUserName, setConfirmedUserName] = useState(null); // User's display name confirmed by Hub

    const chatTitle = "Storehouse Group Chat"; // You can make this dynamic if needed
    const statusBadgeBg = connectionState === signalR.HubConnectionState.Connected ? 'bg-success'
        : connectionState === signalR.HubConnectionState.Connecting || connectionState === signalR.HubConnectionState.Reconnecting ? 'bg-warning'
            : 'bg-danger';
    const statusText = connectionState === signalR.HubConnectionState.Connected ? 'Online'
        : connectionState === signalR.HubConnectionState.Connecting ? 'Connecting...'
            : connectionState === signalR.HubConnectionState.Reconnecting ? 'Reconnecting...'
                : 'Offline';

    useEffect(() => {
        const currentAuthToken = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

        if (!chatOpen) {
            if (connection) {
                console.log("[Chat.jsx] Chat closing, stopping SignalR connection...");
                connection.stop()
                    .then(() => console.log("[Chat.jsx] SignalR connection stopped due to chat close."))
                    .catch(err => console.error("[Chat.jsx] Error stopping SignalR connection on chat close:", err));
                setConnection(null);
                setConnectionState(signalR.HubConnectionState.Disconnected);
                setError(null);
                setConfirmedUserId(null);
                setConfirmedUserName(null);
            }
            return;
        }

        if (!currentAuthToken) {
            setError("Authentication token not found. Please log in to use chat.");
            setConnectionState(signalR.HubConnectionState.Disconnected);
            console.error("[Chat.jsx] No auth token found for SignalR.");
            return;
        }

        if (connection && (connectionState === signalR.HubConnectionState.Connected || connectionState === signalR.HubConnectionState.Connecting || connectionState === signalR.HubConnectionState.Reconnecting)) {
            console.log("[Chat.jsx] SignalR connection already exists or is in progress.");
            return;
        }

        console.log("[Chat.jsx] Setting up new SignalR connection to ChatHub...");
        setError(null); // Clear previous errors
        setConfirmedUserId(null); // Reset confirmed IDs on new connection attempt
        setConfirmedUserName(null);

        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl(CHAT_HUB_URL, {
                accessTokenFactory: () => sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN)
            })
            .withAutomaticReconnect([0, 2000, 5000, 10000, 15000, 25000, null]) // Added null to stop after some retries
            .configureLogging(signalR.LogLevel.Information)
            .build();

        setConnection(newConnection);
        setConnectionState(signalR.HubConnectionState.Connecting);

        newConnection.onreconnecting((error) => {
            console.warn(`[Chat.jsx] SignalR connection lost. Reconnecting... Error: ${error?.message}`);
            setConnectionState(signalR.HubConnectionState.Reconnecting);
            setError('Connection lost. Attempting to reconnect...');
        });

        newConnection.onreconnected((connectionId) => {
            console.log(`[Chat.jsx] SignalR connection re-established. Connection ID: ${connectionId}`);
            setConnectionState(signalR.HubConnectionState.Connected);
            setError(null); // Clear reconnecting error
        });

        newConnection.onclose((error) => {
            console.warn(`[Chat.jsx] SignalR connection closed. Error: ${error?.message}`);
            setConnectionState(signalR.HubConnectionState.Disconnected);
            if (error && error.message !== "Normal close." && !error.message?.includes("Connection started then immediately stopped.")) {
                setError(`Disconnected: ${error.message}. Try refreshing or logging in again.`);
            } else if (!error || error.message === "Normal close.") {
                 setError(null); // Clear error for intentional close
            }
            setConnection(null); // Allow re-connection if chat is re-opened
            setConfirmedUserId(null);
            setConfirmedUserName(null);
        });

        newConnection.on('ConnectionConfirmed', (welcomeMessage, hubConnectionId, userIdFromHub, userNameFromHub) => {
            console.log(`[Chat.jsx] Hub 'ConnectionConfirmed' event received: WelcomeMsg='${welcomeMessage}', HubConnectionID='${hubConnectionId}', UserIDFromHub='${userIdFromHub}', UserNameFromHub='${userNameFromHub}'`);
            if (userIdFromHub) {
                setConfirmedUserId(userIdFromHub); // This should be the GUID
                console.log(`[Chat.jsx] User ID confirmed by Hub and set in state: '${userIdFromHub}'`);
            } else {
                console.error("[Chat.jsx] CRITICAL: Hub did not return a valid 'userIdFromHub' in ConnectionConfirmed. Message sender identification will fail.");
                setError("Chat connection error: User identity could not be confirmed.");
            }
            if (userNameFromHub) {
                setConfirmedUserName(userNameFromHub); // This should be the display name like "Edi"
                console.log(`[Chat.jsx] User Name confirmed by Hub and set in state: '${userNameFromHub}'`);
            } else {
                console.warn("[Chat.jsx] Hub did not return a 'userNameFromHub' in ConnectionConfirmed. Using fallback for display name.");
            }
        });

        newConnection.on('ReceiveGroupMessage', (senderUserId, senderNameFromServer, message, timestamp) => {
            console.log("[Chat.jsx] 'ReceiveGroupMessage' event received:", { senderUserId, senderNameFromServer, message, timestamp });
            const localTime = formatTimestamp(timestamp);
            
            const currentUserIdForComparison = confirmedUserId || sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);
            const isOwnMessage = currentUserIdForComparison && senderUserId === currentUserIdForComparison;

            console.log(`[Chat.jsx] Processing message. Comparing senderId='${senderUserId}' with currentUserIdToCompare='${currentUserIdForComparison}'. Is own: ${isOwnMessage}`);

            let displayName = isOwnMessage ? 'Me' : (senderNameFromServer || 'Anonymous');

            setMessageHistory(prev => [...prev, {
                id: `${timestamp}-${senderUserId}-${Math.random().toString(36).slice(2, 7)}`,
                senderUserId,
                senderName: senderUserId,
                msg: message,
                time: localTime,
                type: isOwnMessage ? 0 : 1
            }]);
        });

        newConnection.on('ReceiveError', (errorMessage) => {
             console.error(`[Chat.jsx] Hub sent 'ReceiveError': ${errorMessage}`);
             setError(`Server Error: ${errorMessage}`);
             setTimeout(() => setError(null), 7000);
        });

        newConnection.on('ReceiveWarning', (warningMessage) => {
            console.warn(`[Chat.jsx] Hub sent 'ReceiveWarning': ${warningMessage}`);
            // You might want to show this to the user in a less obtrusive way
        });

        const startConnection = async () => {
            try {
                await newConnection.start();
                console.log("[Chat.jsx] SignalR Connected successfully to ChatHub.");
                setConnectionState(signalR.HubConnectionState.Connected);
                setError(null); // Clear any previous connection errors
            } catch (err) {
                console.error('[Chat.jsx] SignalR connection failed to start:', err);
                let friendlyError = `Chat Connection Failed: ${err.message || 'Server unavailable or access denied.'}`;
                if (err.statusCode === 401 || err.message?.includes("401")) {
                    friendlyError = "Chat Connection Failed: Unauthorized. Your session might be invalid or expired. Please log out and log back in.";
                }
                setConnectionState(signalR.HubConnectionState.Disconnected);
                setError(friendlyError);
                setConnection(null);
            }
        };

        startConnection();

        return () => { // Cleanup function on component unmount or when chatOpen changes
            if (newConnection) {
                console.log("[Chat.jsx] Cleanup: Stopping ChatHub SignalR connection...");
                newConnection.stop()
                    .then(() => console.log("[Chat.jsx] ChatHub SignalR connection stopped cleanly via cleanup."))
                    .catch(err => console.error("[Chat.jsx] Error stopping ChatHub SignalR connection during cleanup:", err));
            }
        };
    }, [chatOpen]); // Only re-run this effect if chatOpen changes

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: 'end' });
        }
    }, [messageHistory]); // Scroll when new messages arrive

    const handleSendMessage = useCallback(async () => {
        if (connection && connectionState === signalR.HubConnectionState.Connected && messageInput.trim()) {
            try {
                await connection.invoke('SendMessageToGroup', messageInput);
                setMessageInput(''); // Clear input after sending
            } catch (err) {
                console.error('[Chat.jsx] Error sending message to ChatHub:', err);
                setError(`Failed to send message: ${err.message || 'Server error'}`);
            }
        } else if (!messageInput.trim()) {
            // Optionally provide feedback or just do nothing for empty messages
            console.warn("[Chat.jsx] Attempted to send empty message.");
        } else {
            console.warn("[Chat.jsx] Cannot send message: Connection not in 'Connected' state or connection is null.");
            setError("Not connected to chat. Please wait for connection or try refreshing.");
        }
    }, [connection, connectionState, messageInput]);

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, allow Shift+Enter for new line
            e.preventDefault();
            handleSendMessage();
        }
    };

    const displayNameInHeader = confirmedUserName || user?.name || sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_NAME) || 'User';

    return (
        <div className={`chat-container ${chatOpen ? 'd-flex' : 'd-none'} flex-column h-100`}> {/* Ensure chat container takes height */}
            <div className="chat-header border-bottom d-flex justify-content-between align-items-center px-3 py-2 flex-shrink-0">
                 <div>
                    <h6 className="mb-0 me-2 d-inline-block">{chatTitle}</h6>
                    <small className={`badge ${statusBadgeBg} me-2 align-middle`}>{statusText}</small>
                    <small className="text-muted d-none d-sm-inline">({displayNameInHeader})</small>
                </div>
                <Button variant="light" size="sm" onClick={closed} aria-label="Close Chat" className="p-1">
                    <i className="feather icon-x" style={{ fontSize: '1.2rem' }} />
                </Button>
            </div>

            {error && (
                 <Alert 
                    variant={connectionState === signalR.HubConnectionState.Reconnecting ? "warning" : "danger"}
                    className="chat-alert m-2 text-center py-1 flex-shrink-0"
                    onClose={() => setError(null)}
                    dismissible={connectionState !== signalR.HubConnectionState.Reconnecting}
                 >
                    {error}
                </Alert>
            )}

            <div
                ref={messagesContainerRef}
                className="chat-messages flex-grow-1 px-3 py-2 overflow-auto" // Ensure this can grow and scroll
            >
                <div className="d-flex flex-column">
                    {messageHistory.map((msg) => (
                        <div key={msg.id} className={`message-row d-flex mb-2 ${msg.type === 0 ? 'justify-content-end' : 'justify-content-start'}`}>
                            <Card
                                bg={msg.type === 0 ? 'primary' : 'light'}
                                text={msg.type === 0 ? 'white' : 'dark'}
                                className={`p-2 shadow-sm message-card ${msg.type === 0 ? 'message-sent' : 'message-received'}`}
                                style={{ maxWidth: '75%' }} // Prevent messages from taking full width
                            >
                                {msg.type === 1 && (
                                    <div className="message-sender mb-1 fw-bold" style={{ fontSize: '0.8rem' }}>
                                        {msg.senderName}
                                    </div>
                                )}
                                <div className="message-content" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {msg.msg}
                                </div>
                                <div className={`message-timestamp text-end mt-1 ${msg.type === 0 ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.75rem' }}>
                                    <small>{msg.time}</small>
                                </div>
                            </Card>
                        </div>
                    ))}
                    <div ref={messagesEndRef} style={{ height: '1px' }} />
                </div>
            </div>

            <div className="chat-input border-top p-3 bg-light flex-shrink-0">
                 <InputGroup>
                    <FormControl
                        placeholder="Type your message..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        as="textarea"
                        rows={1} // Auto-grows with CSS potentially, or set fixed rows
                        disabled={connectionState !== signalR.HubConnectionState.Connected}
                        aria-label="Chat message input"
                        maxLength={500}
                        className="me-2"
                        style={{ resize: 'none', overflowY: 'auto', maxHeight: '80px' }} // Allow some growth for textarea
                    />
                    <Button
                        variant="primary"
                        onClick={handleSendMessage}
                        disabled={!messageInput.trim() || connectionState !== signalR.HubConnectionState.Connected}
                        aria-label="Send message"
                    >
                        {connectionState === signalR.HubConnectionState.Connecting || connectionState === signalR.HubConnectionState.Reconnecting ? (
                            <Spinner animation="border" size="sm" />
                        ) : (
                             "Send"
                        )}
                    </Button>
                 </InputGroup>
            </div>
        </div>
    );
};

Chat.propTypes = {
    user: PropTypes.shape({
        id: PropTypes.string, // GUID
        name: PropTypes.string, // Display Name
        // userName: PropTypes.string, // Login username if different from display name
    }),
    chatOpen: PropTypes.bool.isRequired,
    closed: PropTypes.func.isRequired,
};

export default Chat;