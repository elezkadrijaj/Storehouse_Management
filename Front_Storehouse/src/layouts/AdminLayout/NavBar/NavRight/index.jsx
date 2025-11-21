import React, { useState, useEffect, useRef } from 'react';
import { Card, ListGroup, Dropdown, Badge } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import PerfectScrollbar from 'react-perfect-scrollbar';
import * as signalR from '@microsoft/signalr';
import apiClient from '../../../../appService'; // Import apiClient for the logout call

import ChatList from './ChatList';
import avatar1 from '../../../../assets/images/user/avatar-1.jpg';

// REFACTORED: TOKEN is no longer used here. We use these keys for UI state.
const SESSION_STORAGE_KEYS = {
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

// The full URL is needed for the SignalR client connection.
const ORDER_HUB_URL = 'https://localhost:7204/orderNotificationHub';

const NavRight = () => {
    // All UI state hooks remain the same.
    const [listOpen, setListOpen] = useState(false);
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const connectionRef = useRef(null);

    // --- START OF FIX ---

    // UPDATED: The new, correct way to check for authentication status and get user info.
    const isAuthenticated = !!sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
    const username = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_NAME) || 'User';

    useEffect(() => {
        // Only attempt to connect if the user is authenticated and there's no active connection.
        if (isAuthenticated && !connectionRef.current) {
            
            // REFACTORED: Simplified SignalR connection builder.
            // By using `withUrl` and having the backend configured correctly for cookies,
            // the SignalR client will attempt to use the HttpOnly cookie for authentication.
            const newConnection = new signalR.HubConnectionBuilder()
                .withUrl(ORDER_HUB_URL) // The accessTokenFactory is no longer needed.
                .withAutomaticReconnect()
                .configureLogging(signalR.LogLevel.Information)
                .build();

            connectionRef.current = newConnection;

            // All your SignalR .on() listeners remain the same.
            newConnection.on("ReceiveOrderCreated", (notification) => {
                const newNotification = {
                    id: `order-${notification.orderId}-created-${Date.now()}`,
                    type: 'created',
                    data: notification,
                    timestamp: new Date(),
                    read: false,
                    message: `New order #${notification.orderId} created by ${notification.createdByUserName} for ${notification.clientName}.`,
                    icon: avatar1,
                };
                setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
                setUnreadCount(prev => prev + 1);
            });

            newConnection.on("ReceiveOrderStatusUpdate", (notification) => {
                const newNotification = {
                    id: `order-${notification.orderId}-status-${Date.now()}`,
                    type: 'updated',
                    data: notification,
                    timestamp: new Date(),
                    read: false,
                    message: `Order #${notification.orderId} status updated to ${notification.newStatus} by ${notification.updatedByUserName}.`,
                    icon: avatar1,
                };
                setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
                setUnreadCount(prev => prev + 1);
            });

            newConnection.start()
                .then(() => console.log("[NavRight] SignalR Connected to Order Hub successfully."))
                .catch(err => {
                    console.error("[NavRight] SignalR Connection Error on start: ", err);
                    connectionRef.current = null; // Reset on failure
                });

            newConnection.onclose(error => {
                console.warn("[NavRight] SignalR connection closed.", error);
            });
        }

        // Cleanup function for when the component unmounts or auth state changes.
        return () => {
            if (connectionRef.current) {
                connectionRef.current.stop();
                connectionRef.current = null;
            }
        };
    }, [isAuthenticated]); // Rerun this effect if isAuthenticated changes.

    // UPDATED: Correct logout handler.
    const handleLogout = async () => {
        // Stop the SignalR connection first.
        if (connectionRef.current) {
             connectionRef.current.stop();
             connectionRef.current = null;
        }

        try {
            // Call the backend endpoint to clear the HttpOnly cookie.
            await apiClient.post('/Account/logout');
        } catch (error) {
            console.error("Logout API call failed, but proceeding with client cleanup:", error);
        } finally {
            // Always clear client-side session data.
            Object.values(SESSION_STORAGE_KEYS).forEach(key => sessionStorage.removeItem(key));
            
            // Redirect to the login page.
            navigate('/auth/signin-1');
        }
    };

    // --- END OF FIX ---

    // All other handlers and helper functions remain the same.
    const handleMarkAllRead = (e) => {
        e.preventDefault();
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    const handleClearAll = (e) => {
        e.preventDefault();
        setNotifications([]);
        setUnreadCount(0);
    };

    const formatTimeAgo = (timestamp) => {
        const secondsPast = (new Date().getTime() - new Date(timestamp).getTime()) / 1000;
        if (secondsPast < 60) return `${Math.round(secondsPast)}s ago`;
        if (secondsPast < 3600) return `${Math.round(secondsPast / 60)}m ago`;
        return `${Math.round(secondsPast / 3600)}h ago`;
    };

    // If not authenticated, don't render anything from this component.
    if (!isAuthenticated) {
        return null;
    }

    // The entire return JSX remains exactly the same.
    return (
        <React.Fragment>
            <ListGroup as="ul" bsPrefix=" " className="navbar-nav ml-auto" id="navbar-right">
                <ListGroup.Item as="li" bsPrefix=" ">
                    <Dropdown align="end">
                        <Dropdown.Toggle as={Link} variant="link" to="#" id="dropdown-basic-noti" className="position-relative">
                            <i className="feather icon-bell icon" />
                            {unreadCount > 0 && (
                                <Badge pill bg="danger" className="position-absolute top-0 start-100 translate-middle" style={{ fontSize: '0.6em', padding: '0.3em 0.5em' }}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </Badge>
                            )}
                        </Dropdown.Toggle>
                        <Dropdown.Menu align="end" className="notification notification-scroll">
                            <div className="noti-head">
                                <h6 className="d-inline-block m-b-0">Notifications</h6>
                                <div className="float-end">
                                    <Link to="#" className="me-2" onClick={handleMarkAllRead}>mark all as read</Link>
                                    <Link to="#" onClick={handleClearAll}>clear all</Link>
                                </div>
                            </div>
                            <PerfectScrollbar options={{ wheelSpeed: 0.5, suppressScrollX: true }}>
                                <ListGroup as="ul" bsPrefix=" " variant="flush" className="noti-body">
                                    {notifications.length === 0 ? (
                                        <ListGroup.Item as="li" bsPrefix=" " className="notification text-center text-muted py-3">
                                            No new notifications
                                        </ListGroup.Item>
                                    ) : (
                                        notifications.map((noti) => (
                                            <ListGroup.Item
                                                key={noti.id}
                                                as={Link}
                                                to={`/app/order?orderId=${noti.data.orderId}`}
                                                bsPrefix=" "
                                                className={`notification ${!noti.read ? 'bg-light' : ''}`}
                                                onClick={() => {
                                                    setNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, read: true } : n));
                                                    if (!noti.read) setUnreadCount(prev => Math.max(0, prev - 1));
                                                }}
                                            >
                                                <div className="d-flex align-items-center">
                                                    <img className="img-radius" src={noti.icon} alt="Notification icon" style={{ width: '40px', height: '40px' }} />
                                                    <div className="p-0 ms-3">
                                                        <p className="mb-0">
                                                            {noti.message}
                                                            <span className="n-time text-muted float-end">
                                                                <i className="icon feather icon-clock me-1" />{formatTimeAgo(noti.timestamp)}
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </ListGroup.Item>
                                        ))
                                    )}
                                </ListGroup>
                            </PerfectScrollbar>
                        </Dropdown.Menu>
                    </Dropdown>
                </ListGroup.Item>

                <ListGroup.Item as="li" bsPrefix=" ">
                    <Dropdown>
                        <Dropdown.Toggle as={Link} variant="link" to="#" className="displayChatbox" onClick={() => setListOpen(true)}>
                            <i className="icon feather icon-mail" />
                        </Dropdown.Toggle>
                    </Dropdown>
                </ListGroup.Item>

                <ListGroup.Item as="li" bsPrefix=" ">
                    <Dropdown align={'end'} className="drp-user">
                        <Dropdown.Toggle as={Link} variant="link" to="#" id="dropdown-basic-user">
                            <i className="icon feather icon-user" />
                        </Dropdown.Toggle>
                        <Dropdown.Menu align="end" className="profile-notification">
                            <div className="pro-head bg-light border-bottom mb-1 pb-2">
                                <img src={avatar1} className="img-radius me-2" alt="User Profile" />
                                <span className="fw-bold text-dark">{username}</span>
                            </div>
                            <ListGroup as="ul" bsPrefix=" " variant="flush" className="pro-body">
                                <Dropdown.Item as={Link} to="/app/userprofile"><i className="feather icon-user me-2" /> Profile</Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item as="button" onClick={handleLogout} className="text-danger"><i className="feather icon-log-out me-2" /> Logout</Dropdown.Item>
                            </ListGroup>
                        </Dropdown.Menu>
                    </Dropdown>
                </ListGroup.Item>
            </ListGroup>
            <ChatList listOpen={listOpen} closed={() => setListOpen(false)} />
        </React.Fragment>
    );
};

export default NavRight;