import React, { useState, useEffect, useRef } from 'react'; // Added useEffect, useRef
import { Card, ListGroup, Dropdown, Badge } from 'react-bootstrap'; // Added Badge
import { Link, useNavigate } from 'react-router-dom';
import PerfectScrollbar from 'react-perfect-scrollbar';
import * as signalR from '@microsoft/signalr'; // Import SignalR

import ChatList from './ChatList';

import avatar1 from '../../../../assets/images/user/avatar-1.jpg';
// Import other avatars if needed dynamically, or use a default/icon
// import avatar2 from '../../../../assets/images/user/avatar-2.jpg';
// import avatar3 from '../../../../assets/images/user/avatar-3.jpg';
// import avatar4 from '../../../../assets/images/user/avatar-4.jpg';
import defaultNotificationIcon from '../../../../assets/images/user/avatar-2.jpg'; // Example: Add a default icon

// --- Define Keys for Session Storage (MUST MATCH Signin1.js & UserProfile.js) ---
const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

// --- Configuration ---
// IMPORTANT: Replace with your actual API base URL
const API_BASE_URL = 'https://localhost:7204'; // Or your backend URL like 'http://localhost:5000'
const ORDER_HUB_URL = `${API_BASE_URL}/orderNotificationHub`;

const NavRight = () => {
  const [listOpen, setListOpen] = useState(false);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]); // State to hold notifications
  const [unreadCount, setUnreadCount] = useState(0); // State for unread count
  const connectionRef = useRef(null); // Ref to hold the connection object

  // --- Get authentication state and username from sessionStorage ---
  const isAuthenticated = !!sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
  const username = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_NAME) || 'User';
  const authToken = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN); // Get token for SignalR connection

  // --- Effect for SignalR Connection ---
  useEffect(() => {
    if (isAuthenticated && authToken && !connectionRef.current) { // Only connect if authenticated and not already connected
      // Create connection
      const newConnection = new signalR.HubConnectionBuilder()
        .withUrl(ORDER_HUB_URL, {
          // Send the token for authentication if your Hub requires it
           accessTokenFactory: () => authToken
        })
        .withAutomaticReconnect() // Automatically try to reconnect if connection is lost
        .configureLogging(signalR.LogLevel.Information) // Optional: Configure logging
        .build();

      connectionRef.current = newConnection; // Store connection in ref

      // --- Define Handlers for Received Messages ---

      // Handler for Order Created
      newConnection.on("ReceiveOrderCreated", (notification) => {
        console.log("Received OrderCreated notification:", notification);
        const newNotification = {
            id: `order-${notification.orderId}-created-${Date.now()}`, // Unique ID
            type: 'created',
            data: notification,
            timestamp: new Date(),
            read: false,
            message: `New order #${notification.orderId} created by ${notification.createdByUserName} for ${notification.clientName}.`,
            icon: avatar1, // Or use a generic icon
        };
        setNotifications(prev => [newNotification, ...prev.slice(0, 9)]); // Add to start, limit to 10 total
        setUnreadCount(prev => prev + 1);
        // Optional: Show a browser notification or toast
        // showToast(`New Order #${notification.orderId} Created!`);
      });

      // Handler for Order Status Updated
      newConnection.on("ReceiveOrderStatusUpdate", (notification) => {
        console.log("Received OrderStatusUpdate notification:", notification);
         const newNotification = {
            id: `order-${notification.orderId}-status-${Date.now()}`, // Unique ID
            type: 'updated',
            data: notification,
            timestamp: new Date(),
            read: false,
            message: `Order #${notification.orderId} status updated to ${notification.newStatus} by ${notification.updatedByUserName}.`,
            icon: avatar1, // Or use a generic icon
        };
        setNotifications(prev => [newNotification, ...prev.slice(0, 9)]); // Add to start, limit to 10 total
        setUnreadCount(prev => prev + 1);
         // Optional: Show a browser notification or toast
         // showToast(`Order #${notification.orderId} status updated to ${notification.newStatus}`);
      });

      // --- Start the connection ---
      newConnection.start()
        .then(() => {
            console.log("SignalR Connected to Order Hub successfully.");
            // You could potentially join groups here if needed:
            // newConnection.invoke("JoinGroup", "StoreManagers").catch(err => console.error("Error joining group:", err));
        })
        .catch(err => {
            console.error("SignalR Connection Error: ", err);
            connectionRef.current = null; // Reset ref on failed start
        });

      // Handle connection closing
      newConnection.onclose(error => {
        console.warn("SignalR connection closed.", error);
        // Optionally update UI state to show disconnected status
        connectionRef.current = null; // Clear ref when closed
      });

      // Handle reconnection attempt
       newConnection.onreconnecting(error => {
         console.info("SignalR attempting to reconnect...", error);
         // Optionally update UI state
       });

       // Handle successful reconnection
       newConnection.onreconnected(connectionId => {
         console.info("SignalR reconnected successfully. Connection ID:", connectionId);
         // Optionally update UI state
       });


      // --- Cleanup on component unmount ---
      return () => {
        if (connectionRef.current) {
          console.log("Stopping SignalR connection...");
          connectionRef.current.stop()
            .then(() => console.log("SignalR connection stopped."))
            .catch(err => console.error("Error stopping SignalR connection:", err));
          connectionRef.current = null; // Clear the ref
        }
      };
    } else if (!isAuthenticated && connectionRef.current) {
        // If user logs out while component is mounted, stop connection
        console.log("User logged out, stopping SignalR connection...");
        connectionRef.current.stop()
            .then(() => console.log("SignalR connection stopped due to logout."))
            .catch(err => console.error("Error stopping SignalR connection on logout:", err));
        connectionRef.current = null; // Clear the ref
        setNotifications([]); // Clear notifications on logout
        setUnreadCount(0);
    }

    // Add dependencies: connect/disconnect when auth state changes
  }, [isAuthenticated, authToken]);
  // --- End Effect ---

  // --- Logout Handler (remains the same) ---
  const handleLogout = () => {
    console.log("Logging out user from this tab's session...");
    Object.values(SESSION_STORAGE_KEYS).forEach(key => {
        sessionStorage.removeItem(key);
    });
    console.log("User logged out via NavRight.");
    // SignalR connection cleanup is handled by the useEffect hook when isAuthenticated becomes false
    navigate('/login');
  };

  // --- Mark all as read (Example Handler) ---
  const handleMarkAllRead = (e) => {
      e.preventDefault(); // Prevent default link behavior
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
  };

  // --- Clear all notifications (Example Handler) ---
  const handleClearAll = (e) => {
      e.preventDefault();
      setNotifications([]);
      setUnreadCount(0);
  }

  // --- Helper to format time difference ---
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const secondsPast = (now.getTime() - timestamp.getTime()) / 1000;

    if (secondsPast < 60) {
        return `${Math.round(secondsPast)}s ago`;
    }
    if (secondsPast < 3600) {
        return `${Math.round(secondsPast / 60)}m ago`;
    }
    if (secondsPast <= 86400) {
        return `${Math.round(secondsPast / 3600)}h ago`;
    }
    // For older notifications, you might want to show date/time
    const day = timestamp.getDate();
    const month = timestamp.toDateString().match(/ [a-zA-Z]*/)[0].replace(" ", "");
    const year = timestamp.getFullYear() === now.getFullYear() ? "" : ` ${timestamp.getFullYear()}`;
    return `${day} ${month}${year}`;
  };


  // If the user is not authenticated, don't render
  if (!isAuthenticated) {
    return null;
  }

  return (
    <React.Fragment>
      <ListGroup as="ul" bsPrefix=" " className="navbar-nav ml-auto" id="navbar-right">
        {/* === Notification Dropdown === */}
        <ListGroup.Item as="li" bsPrefix=" ">
          <Dropdown align="end">
            <Dropdown.Toggle as={Link} variant="link" to="#" id="dropdown-basic-noti" className="position-relative">
              <i className="feather icon-bell icon" />
              {/* Unread Count Badge */}
              {unreadCount > 0 && (
                <Badge pill bg="danger" className="position-absolute top-0 start-100 translate-middle" style={{fontSize: '0.6em', padding: '0.3em 0.5em'}}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                  <span className="visually-hidden">unread messages</span>
                </Badge>
              )}
            </Dropdown.Toggle>
            <Dropdown.Menu align="end" className="notification notification-scroll">
              <div className="noti-head">
                <h6 className="d-inline-block m-b-0">Notifications</h6>
                <div className="float-end">
                  {/* Add handlers for these actions */}
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
                            as={Link} // Make items clickable (e.g., navigate to order details)
                            to={`/orders/${noti.data.orderId}`} // Example link - adjust as needed
                            bsPrefix=" "
                            className={`notification ${!noti.read ? 'bg-light' : ''}`} // Highlight unread
                            onClick={() => {
                                // Mark as read on click (optional)
                                setNotifications(prev => prev.map(n => n.id === noti.id ? {...n, read: true} : n));
                                if (!noti.read) setUnreadCount(prev => Math.max(0, prev - 1));
                            }}
                        >
                          <Card className="d-flex align-items-center shadow-none mb-0 p-0 border-0" style={{ flexDirection: 'row', backgroundColor: 'unset' }}>
                            <img className="img-radius" src={noti.icon || defaultNotificationIcon} alt="Notification icon" style={{ width: '40px', height: '40px' }}/>
                            <Card.Body className="p-0 ms-3">
                              <p className="mb-0"> {/* Single line for brevity */}
                                {noti.message}
                                <span className="n-time text-muted float-end">
                                  <i className="icon feather icon-clock me-1" />{formatTimeAgo(noti.timestamp)}
                                </span>
                              </p>
                              {/* Optional: Add more details like status change description */}
                               {noti.type === 'updated' && noti.data.description && (
                                  <p className="mb-0 mt-1 text-muted small fst-italic">
                                      Note: {noti.data.description}
                                  </p>
                               )}
                            </Card.Body>
                          </Card>
                        </ListGroup.Item>
                     ))
                   )}
                 </ListGroup>
               </PerfectScrollbar>
               {/* Footer link (optional) */}
               {/* <div className="noti-footer">
                  <Link to="/notifications">show all notifications</Link>
               </div> */}
            </Dropdown.Menu>
          </Dropdown>
        </ListGroup.Item>
        {/* === End Notification Dropdown === */}

        {/* Chat Dropdown/Button (Remains the same) */}
        <ListGroup.Item as="li" bsPrefix=" ">
          <Dropdown>
            <Dropdown.Toggle as={Link} variant="link" to="#" className="displayChatbox" onClick={() => setListOpen(true)}>
              <i className="icon feather icon-mail" />
            </Dropdown.Toggle>
          </Dropdown>
        </ListGroup.Item>

        {/* User Profile Dropdown (Remains largely the same, uses 'username') */}
        <ListGroup.Item as="li" bsPrefix=" ">
          <Dropdown align={'end'} className="drp-user">
            <Dropdown.Toggle as={Link} variant="link" to="#" id="dropdown-basic-user">
               <i className="icon feather icon-user" />
            </Dropdown.Toggle>
            <Dropdown.Menu align="end" className="profile-notification">
              <div className="pro-head bg-light border-bottom mb-1 pb-2">
                <img src={avatar1} className="img-radius me-2" alt="User Profile" />
                <span className="fw-bold">{username}</span>
              </div>
              <ListGroup as="ul" bsPrefix=" " variant="flush" className="pro-body">
                 <Dropdown.Item as={Link} to="#"><i className="feather icon-settings me-2" /> Settings</Dropdown.Item>
                 <Dropdown.Item as={Link} to="/app/userprofile"><i className="feather icon-user me-2" /> Profile</Dropdown.Item>
                 <Dropdown.Item as={Link} to="#"><i className="feather icon-mail me-2" /> My Messages</Dropdown.Item>
                 <Dropdown.Item as={Link} to="#"><i className="feather icon-lock me-2" /> Lock Screen</Dropdown.Item>
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