import React, { useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Card, FormControl, InputGroup, Spinner } from 'react-bootstrap';
import * as signalR from '@microsoft/signalr';

const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) { return 'Invalid date'; }
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return 'Invalid date';
    }
};

const SESSION_STORAGE_KEYS = {
  TOKEN: 'authToken',
  USER_ID: 'userId',
  USER_NAME: 'userName',
};

const CHAT_HUB_URL = 'https://localhost:7204/chathub';

const Chat = ({ user, chatOpen, closed }) => {
    const [connection, setConnection] = useState(null);
    const [connectionState, setConnectionState] = useState(signalR.HubConnectionState.Disconnected);
    const [messageInput, setMessageInput] = useState('');
    const [messageHistory, setMessageHistory] = useState([]);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!chatOpen) {
            if (connection) {
                connection.stop();
                setConnection(null);
            }
            return;
        }

        if (connection) { return; }

        const currentAuthToken = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
        if (!currentAuthToken) {
            setError("Authentication token not found. Please log in.");
            return;
        }

        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl(CHAT_HUB_URL, { accessTokenFactory: () => currentAuthToken })
            .withAutomaticReconnect()
            .build();

        setConnection(newConnection);
        setConnectionState(signalR.HubConnectionState.Connecting);
        
        newConnection.onreconnecting(() => setConnectionState(signalR.HubConnectionState.Reconnecting));
        newConnection.onreconnected(() => setConnectionState(signalR.HubConnectionState.Connected));
        newConnection.onclose(() => {
            setConnectionState(signalR.HubConnectionState.Disconnected);
            setConnection(null);
        });

        newConnection.on('ReceiveGroupMessage', (senderUserId, senderNameFromServer, message, timestamp) => {
            const localTime = formatTimestamp(timestamp);
            const currentUserId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);
            const isOwnMessage = senderUserId === currentUserId;

            let displayName;
            if (isOwnMessage) {
                displayName = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_NAME) || 'Me';
            } else {
                displayName = senderNameFromServer || 'Anonymous';
            }

            setMessageHistory(prev => [...prev, {
                id: `${timestamp}-${senderUserId}-${Math.random()}`,
                senderName: displayName,
                msg: message,
                time: localTime,
                type: isOwnMessage ? 0 : 1,
            }]);
        });

        newConnection.start()
            .then(() => {
                setConnectionState(signalR.HubConnectionState.Connected);
            })
            .catch(err => {
                setError('Failed to connect to chat.');
                setConnectionState(signalR.HubConnectionState.Disconnected);
                setConnection(null);
            });

        return () => {
            if (newConnection) {
                newConnection.stop();
            }
        };
    }, [chatOpen]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: 'end' });
        }
    }, [messageHistory]);

    const handleSendMessage = useCallback(async () => {
        if (connection && connectionState === signalR.HubConnectionState.Connected && messageInput.trim()) {
            try {
                await connection.invoke('SendMessageToGroup', messageInput);
                setMessageInput('');
            } catch (err) {
                setError(`Failed to send message: ${err.message || 'Server error'}`);
            }
        }
    }, [connection, connectionState, messageInput]);

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const displayNameInHeader = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_NAME) || 'User';
    const chatTitle = "Storehouse Group Chat";
    const statusBadgeBg = connectionState === signalR.HubConnectionState.Connected ? 'bg-success'
        : connectionState === signalR.HubConnectionState.Connecting || connectionState === signalR.HubConnectionState.Reconnecting ? 'bg-warning'
            : 'bg-danger';
    const statusText = connectionState === signalR.HubConnectionState.Connected ? 'Online'
        : connectionState === signalR.HubConnectionState.Connecting ? 'Connecting...'
            : connectionState === signalR.HubConnectionState.Reconnecting ? 'Reconnecting...'
                : 'Offline';

    return (
        <div className={`chat-container ${chatOpen ? 'd-flex' : 'd-none'} flex-column h-100`}>
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
                <Alert variant="danger" className="chat-alert m-2 text-center py-1 flex-shrink-0" onClose={() => setError(null)} dismissible>
                    {error}
                </Alert>
            )}

            <div className="chat-messages flex-grow-1 px-3 py-2 overflow-auto">
                <div className="d-flex flex-column">
                    {messageHistory.map((msg) => (
                        <div key={msg.id} className={`message-row d-flex mb-2 ${msg.type === 0 ? 'justify-content-end' : 'justify-content-start'}`}>
                            <Card bg={msg.type === 0 ? 'primary' : 'light'} text={msg.type === 0 ? 'white' : 'dark'} className="p-2 shadow-sm">
                                <div className="message-sender mb-1 fw-bold" style={{ fontSize: '0.8rem' }}>
                                    {msg.senderName}
                                </div>
                                <div className="message-content" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {msg.msg}
                                </div>
                                <div className={`message-timestamp text-end mt-1 ${msg.type === 0 ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.75rem' }}>
                                    <small>{msg.time}</small>
                                </div>
                            </Card>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
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
                        style={{ resize: 'none' }}
                    />
                    <Button variant="primary" onClick={handleSendMessage} disabled={!messageInput.trim() || connectionState !== signalR.HubConnectionState.Connected}>
                        {connectionState === signalR.HubConnectionState.Connecting ? <Spinner animation="border" size="sm" /> : "Send"}
                    </Button>
                </InputGroup>
            </div>
        </div>
    );
};

Chat.propTypes = {
    user: PropTypes.shape({ id: PropTypes.string, name: PropTypes.string }),
    chatOpen: PropTypes.bool.isRequired,
    closed: PropTypes.func.isRequired,
};

export default Chat;