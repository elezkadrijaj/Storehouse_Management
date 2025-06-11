import React, { useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Card, FormControl, InputGroup, Spinner, Badge } from 'react-bootstrap';
import * as signalR from '@microsoft/signalr';

const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    try {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    const [confirmedUserId, setConfirmedUserId] = useState(null);
    const [confirmedUserName, setConfirmedUserName] = useState(null);

    const chatTitle = "Storehouse Group Chat";
    const statusBadgeBg = connectionState === signalR.HubConnectionState.Connected ? 'success' : connectionState === signalR.HubConnectionState.Connecting || connectionState === signalR.HubConnectionState.Reconnecting ? 'warning' : 'danger';
    const statusText = connectionState === signalR.HubConnectionState.Connected ? 'Online' : connectionState === signalR.HubConnectionState.Connecting ? 'Connecting...' : connectionState === signalR.HubConnectionState.Reconnecting ? 'Reconnecting...' : 'Offline';

    useEffect(() => {
        if (!chatOpen) {
            if (connection) {
                connection.stop();
                setConnection(null);
            }
            return;
        }

        const authToken = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
        if (!authToken) {
            setError("Authentication token not found.");
            return;
        }
        if (connection) return;

        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl(CHAT_HUB_URL, { accessTokenFactory: () => authToken })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();

        setConnection(newConnection);
        setConnectionState(signalR.HubConnectionState.Connecting);
        newConnection.onreconnecting(() => setConnectionState(signalR.HubConnectionState.Reconnecting));
        newConnection.onreconnected(() => setConnectionState(signalR.HubConnectionState.Connected));
        newConnection.onclose(err => {
            setConnectionState(signalR.HubConnectionState.Disconnected);
            if (err) setError(`Disconnected: ${err.message}`);
            setConnection(null);
        });

        newConnection.on('ConnectionConfirmed', (welcomeMessage, hubConnectionId, userIdFromHub, userNameFromHub) => {
            setConfirmedUserId(userIdFromHub);
            setConfirmedUserName(userNameFromHub || sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_NAME));
        });

        newConnection.on('ReceiveMessage', (senderUserId, senderName, message, timestamp) => {
            const currentUserId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);
            const isOwnMessage = senderUserId === currentUserId;
            setMessageHistory(prev => [...prev, {
                id: `${timestamp}-${senderUserId}`,
                senderName: isOwnMessage ? 'Me' : senderName,
                msg: message,
                time: formatTimestamp(timestamp),
                type: isOwnMessage ? 0 : 1
            }]);
        });
        
        newConnection.on('ReceiveError', (errorMessage) => setError(`Server Error: ${errorMessage}`));
        
        newConnection.start()
            .then(() => setConnectionState(signalR.HubConnectionState.Connected))
            .catch(err => {
                setError(`Connection Failed: ${err.message}`);
                setConnectionState(signalR.HubConnectionState.Disconnected);
                setConnection(null);
            });
            
        return () => { if (newConnection) newConnection.stop(); };
    }, [chatOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messageHistory]);

    const handleSendMessage = useCallback(async () => {
        if (connection && connectionState === signalR.HubConnectionState.Connected && messageInput.trim()) {
            try {
                await connection.invoke('SendMessage', messageInput);
                setMessageInput('');
            } catch (err) {
                setError(`Failed to send message: ${err.message}`);
            }
        }
    }, [connection, connectionState, messageInput]);

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };
    
    return (
        <div className={`chat-container d-flex flex-column h-100 ${chatOpen ? '' : 'd-none'}`}>
            <Card.Header className="d-flex justify-content-between align-items-center py-2 px-3">
                <div>
                    <h6 className="mb-0 d-inline-block">{chatTitle}</h6>
                    <Badge bg={statusBadgeBg} className="ms-2">{statusText}</Badge>
                </div>
                <Button variant="light" size="sm" onClick={closed} aria-label="Close Chat" className="p-1">
                    <i className="feather icon-x" style={{ fontSize: '1.2rem' }} />
                </Button>
            </Card.Header>

            <Card.Body className="p-0 d-flex flex-column" style={{ overflow: 'hidden' }}>
                {error && <Alert variant="danger" className="m-2 py-1 text-center" dismissible onClose={() => setError(null)}>{error}</Alert>}
                
                <div className="flex-grow-1 p-3" style={{ overflowY: 'auto' }}>
                    {messageHistory.map((msg) => (
                        <div key={msg.id} className={`d-flex mb-2 ${msg.type === 0 ? 'justify-content-end' : 'justify-content-start'}`}>
                            <div className={`p-2 rounded shadow-sm ${msg.type === 0 ? 'bg-primary text-white' : 'bg-light'}`} style={{ maxWidth: '75%' }}>
                                {msg.type === 1 && <div className="fw-bold" style={{ fontSize: '0.8rem' }}>{msg.senderName}</div>}
                                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.msg}</div>
                                <div className={`text-end mt-1 ${msg.type === 0 ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '0.7rem' }}>{msg.time}</div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-input border-top p-3 bg-light">
                    <InputGroup>
                        <FormControl
                            placeholder="Type your message..." value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)} onKeyPress={handleKeyPress}
                            as="textarea" rows={1} disabled={connectionState !== signalR.HubConnectionState.Connected}
                            style={{ resize: 'none' }}
                        />
                        <Button onClick={handleSendMessage} disabled={!messageInput.trim() || connectionState !== signalR.HubConnectionState.Connected}>
                            {connectionState === signalR.HubConnectionState.Connecting ? <Spinner animation="border" size="sm" /> : "Send"}
                        </Button>
                    </InputGroup>
                </div>
            </Card.Body>
        </div>
    );
};

Chat.propTypes = {
    user: PropTypes.object,
    chatOpen: PropTypes.bool.isRequired,
    closed: PropTypes.func.isRequired,
};

export default Chat;