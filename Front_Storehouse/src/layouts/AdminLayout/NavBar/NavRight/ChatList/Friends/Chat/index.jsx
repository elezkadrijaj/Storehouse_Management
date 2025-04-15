import React, { useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Card, FormControl, InputGroup, Spinner } from 'react-bootstrap';
import * as signalR from '@microsoft/signalr';
import cookieUtils from 'views/auth/cookieUtils';

const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        console.error("Error formatting timestamp:", e);
        return 'Invalid date';
    }
};

const Chat = ({ user, chatOpen, closed }) => {
    const [connection, setConnection] = useState(null);
    const [connectionState, setConnectionState] = useState(signalR.HubConnectionState.Disconnected);
    const [messageInput, setMessageInput] = useState('');
    const [messageHistory, setMessageHistory] = useState([]);
    const [error, setError] = useState(null);
    const messagesContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const [confirmedUserId, setConfirmedUserId] = useState(null);

    const chatTitle = "Storehouse Group Chat";
    const statusBadgeBg = connectionState === signalR.HubConnectionState.Connected ? 'bg-success'
        : connectionState === signalR.HubConnectionState.Connecting || connectionState === signalR.HubConnectionState.Reconnecting ? 'bg-warning'
            : 'bg-danger';
    const statusText = connectionState === signalR.HubConnectionState.Connected ? 'Online'
        : connectionState === signalR.HubConnectionState.Connecting ? 'Connecting...'
            : connectionState === signalR.HubConnectionState.Reconnecting ? 'Reconnecting...'
                : 'Offline';

    useEffect(() => {
        const token = sessionStorage.getItem('authToken');

        if (!chatOpen) {
            if (connection) {
                console.log("Chat closing, stopping SignalR connection...");
                connection.stop()
                    .then(() => console.log("SignalR connection stopped due to chat close."))
                    .catch(err => console.error("Error stopping SignalR connection on chat close:", err));
                setConnection(null);
                setConnectionState(signalR.HubConnectionState.Disconnected);
                setMessageHistory([]);
                setError(null);
                setConfirmedUserId(null);
            }
            return;
        }

        if (!token) {
            setError("Authentication token not found. Please log in.");
            setConnectionState(signalR.HubConnectionState.Disconnected);
            console.error("Chat Effect: No token found.");
            return;
        }

        if (!user || !user.id) {
            console.warn("Chat Effect: User prop is potentially missing ID. Relying on Hub confirmation.");
        }

        if (connection && connectionState !== signalR.HubConnectionState.Disconnected) {
            console.log("Chat Effect: Connection already exists or is in progress.");
            return;
        }

        console.log("Chat Effect: Setting up SignalR connection...");
        setError(null);
        setConfirmedUserId(null);

        const connectionUrl = `https://localhost:7204/chathub?access_token=${encodeURIComponent(token)}`;
        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl(connectionUrl, { transport: signalR.HttpTransportType.WebSockets })
            .withAutomaticReconnect([0, 2000, 5000, 10000, 15000, 30000])
            .configureLogging(signalR.LogLevel.Information)
            .build();

        setConnection(newConnection);
        setConnectionState(signalR.HubConnectionState.Connecting);

        newConnection.onreconnecting((error) => {
            console.warn(`SignalR connection lost. Reconnecting... Error: ${error?.message}`);
            setConnectionState(signalR.HubConnectionState.Reconnecting);
            setError('Connection lost. Attempting to reconnect...');
        });

        newConnection.onreconnected((connectionId) => {
            console.log(`SignalR connection re-established. Connection ID: ${connectionId}`);
            setConnectionState(signalR.HubConnectionState.Connected);
            setError(null);
        });

        newConnection.onclose((error) => {
            console.error(`SignalR connection closed permanently. Error: ${error?.message}`);
            setConnectionState(signalR.HubConnectionState.Disconnected);
            if (error) {
                setError(`Disconnected: ${error.message}. Please refresh or try again later.`);
            } else {
                setError("Disconnected from chat.");
            }
            setConnection(null);
            setConfirmedUserId(null);
        });

        newConnection.on('ReceiveGroupMessage', (senderUserId, senderNameFromServer, message, timestamp) => {
            console.log("Message received:", { senderUserId, senderNameFromServer, message, timestamp });
            const localTime = formatTimestamp(timestamp);
            const currentUserId = sessionStorage.getItem('userId');
            const isOwnMessage = currentUserId !== null && senderUserId === currentUserId;

            console.log(`>>> Checking message origin: senderId='${senderUserId}', sessionStorageUserId='${currentUserId}'. Is own message? ${isOwnMessage}`);

            let displayName;
            if (isOwnMessage) {
                displayName = 'Me';
            } else {
                displayName = senderNameFromServer || 'Unknown User';
            }

            setMessageHistory(prev => [...prev, {
                id: `${timestamp}-${currentUserId}-${Math.random()}`,
                senderUserId,
                senderName: displayName,
                msg: message,
                time: localTime,
                type: isOwnMessage ? 0 : 1
            }]);
        });

        newConnection.on('ConnectionConfirmed', (welcomeMessage, connectionId) => {
            console.log(`Hub Confirmation Received: "${welcomeMessage}" (SignalR Connection ID: ${connectionId})`);
            const match = welcomeMessage.match(/Welcome user ID: (.*)/i);

            if (match && match[1]) {
                const userIdFromHub = match[1].trim();
                console.log(`>>> SUCCESS: Extracted user ID from Hub confirmation: '${userIdFromHub}'`);
                setConfirmedUserId(userIdFromHub);
            } else {
                console.warn(`>>> FAILED: Could not parse user ID from welcome message: "${welcomeMessage}". Check the regex in the code! Sent messages might appear on the left.`);
            }
        });


        newConnection.on('ReceiveError', (errorMessage) => {
             console.error(`Hub Error Received: ${errorMessage}`);
             setError(`Server Error: ${errorMessage}`);
             setTimeout(() => setError(null), 5000);
        });

        newConnection.on('ReceiveWarning', (warningMessage) => {
            console.warn(`Hub Warning Received: ${warningMessage}`);
        });

        const startConnection = async () => {
            try {
                await newConnection.start();
                console.log("SignalR Connected successfully.");
                setConnectionState(signalR.HubConnectionState.Connected);
                setError(null);
            } catch (err) {
                console.error('SignalR connection failed to start:', err);
                setConnectionState(signalR.HubConnectionState.Disconnected);
                setError(`Connection Failed: ${err.message || 'Server unavailable'}`);
                setConnection(null);
            }
        };
        startConnection();

        return () => {
            if (newConnection) {
                console.log("Chat Unmounting/Re-rendering: Stopping SignalR connection...");
                newConnection.stop()
                    .then(() => console.log("SignalR connection stopped cleanly."))
                    .catch(err => console.error("Error stopping SignalR connection during cleanup:", err));
                setConnection(null);
                setConnectionState(signalR.HubConnectionState.Disconnected);
                setConfirmedUserId(null);
            }
        };
    }, [chatOpen]);

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (container) {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        }
    }, [messageHistory]);

    const handleSendMessage = useCallback(async () => {
        if (connection && connectionState === signalR.HubConnectionState.Connected && messageInput.trim()) {
            try {
                await connection.invoke('SendMessageToGroup', messageInput);
                setMessageInput('');
            } catch (err) {
                console.error('Error sending message:', err);
                setError(`Failed to send: ${err.message}`);
            }
        } else if (!messageInput.trim()) {
            console.warn("Attempted to send empty message.");
        } else {
            console.warn("Cannot send message, connection not in 'Connected' state or connection object missing.");
            setError("Not connected. Please wait or refresh.");
        }
    }, [connection, connectionState, messageInput]);

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className={`chat-container ${chatOpen ? 'd-flex' : 'd-none'} flex-column`}>
            <div className="chat-header border-bottom d-flex justify-content-between align-items-center px-3 py-2 flex-shrink-0">
                 <div>
                    <h6 className="mb-0 me-2 d-inline-block">{chatTitle}</h6>
                    <small className={`badge ${statusBadgeBg} me-2 align-middle`}>{statusText}</small>
                    <small className="text-muted d-none d-sm-inline">({user?.name || confirmedUserId || '...'})</small>
                </div>
                <Button variant="light" size="sm" onClick={closed} aria-label="Close Chat" className="p-1">
                    <i className="feather icon-x" style={{ fontSize: '1.2rem' }} />
                </Button>
            </div>

            {error && (
                 <Alert variant={connectionState === signalR.HubConnectionState.Reconnecting ? "warning" : "danger"}
                    className="chat-alert m-2 text-center py-1 flex-shrink-0"
                    onClose={() => setError(null)}
                    dismissible={connectionState !== signalR.HubConnectionState.Reconnecting}>
                    {error}
                </Alert>
            )}

            <div
                ref={messagesContainerRef}
                className="chat-messages flex-grow-1 px-3 py-2 overflow-auto"
            >
                <div className="d-flex flex-column">
                    {messageHistory.map((msg) => (
                        <div key={msg.id} className={`message-row d-flex mb-2 ${msg.type === 0 ? 'justify-content-end' : 'justify-content-start'}`}>
                            <Card
                                bg={msg.type === 0 ? 'primary' : 'light'}
                                text={msg.type === 0 ? 'white' : 'dark'}
                                className={`p-2 shadow-sm message-card ${msg.type === 0 ? 'message-sent' : 'message-received'}`}
                            >
                                {msg.type === 1 && (
                                    <div className="message-sender mb-1 fw-bold">
                                        {msg.senderName}
                                    </div>
                                )}
                                <div className="message-content">{msg.msg}</div>
                                <div className={`message-timestamp text-end mt-1 ${msg.type === 0 ? 'text-white-50' : 'text-muted'}`}>
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
                        rows={1}
                        disabled={connectionState !== signalR.HubConnectionState.Connected}
                        aria-label="Chat message input"
                        maxLength={500}
                        className="me-2"
                        style={{ resize: 'none' }}
                    />
                    <Button
                        variant="primary"
                        onClick={handleSendMessage}
                        disabled={!messageInput.trim() || connectionState !== signalR.HubConnectionState.Connected}
                        aria-label="Send message"
                    >
                        {connectionState === signalR.HubConnectionState.Connecting ? (
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
        id: PropTypes.string,
        name: PropTypes.string,
        userName: PropTypes.string,
    }),
    chatOpen: PropTypes.bool.isRequired,
    closed: PropTypes.func.isRequired,
};

export default Chat;