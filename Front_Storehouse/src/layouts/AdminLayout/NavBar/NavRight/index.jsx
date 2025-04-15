import React, { useState, useEffect } from 'react'; // Added useEffect for potential future use or if needed based on state changes
import { Card, ListGroup, Dropdown } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import PerfectScrollbar from 'react-perfect-scrollbar';

// import cookieUtils from 'views/auth/cookieUtils'; // No longer using cookieUtils for auth state here

import ChatList from './ChatList';

import avatar1 from '../../../../assets/images/user/avatar-1.jpg';
import avatar2 from '../../../../assets/images/user/avatar-2.jpg';
import avatar3 from '../../../../assets/images/user/avatar-3.jpg';
import avatar4 from '../../../../assets/images/user/avatar-4.jpg';

// --- Define Keys for Session Storage (MUST MATCH Signin1.js & UserProfile.js) ---
const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

const NavRight = () => {
  const [listOpen, setListOpen] = useState(false);
  const navigate = useNavigate(); // Hook for programmatic navigation

  // --- Get authentication state and username from sessionStorage ---
  const isAuthenticated = !!sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
  const username = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_NAME) || 'User'; // Fallback to 'User'
  // --- End sessionStorage Reading ---


  // --- Static Notification Data (remains the same) ---
  const notiData = [
    { name: 'Joseph William', image: avatar2, details: 'Purchase New Theme and make payment', activity: '30 min' },
    { name: 'Sara Soudein', image: avatar3, details: 'currently login', activity: '30 min' },
    { name: 'Suzen', image: avatar4, details: 'Purchase New Theme and make payment', activity: 'yesterday' }
  ];


  // --- Logout Handler ---
  const handleLogout = () => {
    // Clear all relevant items from sessionStorage for this tab
    console.log("Logging out user from this tab's session...");
    Object.values(SESSION_STORAGE_KEYS).forEach(key => {
        sessionStorage.removeItem(key);
        console.log(`Removed ${key} from sessionStorage`); // Optional: confirm removal
    });

    console.log("User logged out via NavRight.");
    // Redirect to the login page after clearing session storage
    navigate('/login'); // Or your designated login route
    // Optionally force a reload if state outside React isn't updating correctly, but usually navigate is enough
    // window.location.reload();
  };
  // --- End Logout Handler ---


  // If the user is not authenticated in this tab's session, don't render this component
  if (!isAuthenticated) {
    // console.log("[NavRight] User not authenticated in this session, rendering null."); // Optional debug log
    return null; // Don't show the nav elements if not logged in for this tab
  }

  // console.log(`[NavRight] Rendering for user: ${username} (from sessionStorage)`); // Optional debug log

  // --- Component Return (JSX remains largely the same, uses 'username' from sessionStorage) ---
  return (
    <React.Fragment>
      <ListGroup as="ul" bsPrefix=" " className="navbar-nav ml-auto" id="navbar-right">
        {/* Notification Dropdown */}
        <ListGroup.Item as="li" bsPrefix=" ">
          <Dropdown align="end">
            <Dropdown.Toggle as={Link} variant="link" to="#" id="dropdown-basic-noti"> {/* Added unique ID */}
              <i className="feather icon-bell icon" />
            </Dropdown.Toggle>
            <Dropdown.Menu align="end" className="notification notification-scroll">
              <div className="noti-head">
                <h6 className="d-inline-block m-b-0">Notifications</h6>
                <div className="float-end">
                  <Link to="#" className="me-2">mark as read</Link>
                  <Link to="#">clear all</Link>
                </div>
              </div>
              <PerfectScrollbar options={{ wheelSpeed: 0.5, suppressScrollX: true }}> {/* Added scrollbar options */}
                <ListGroup as="ul" bsPrefix=" " variant="flush" className="noti-body">
                  {/* Example New Notification */}
                  <ListGroup.Item as="li" bsPrefix=" " className="n-title"><p className="m-b-0">NEW</p></ListGroup.Item>
                  <ListGroup.Item as="li" bsPrefix=" " className="notification">
                    <Card className="d-flex align-items-center shadow-none mb-0 p-0 border-0" style={{ flexDirection: 'row', backgroundColor: 'unset' }}>
                      <img className="img-radius" src={avatar1} alt="Generic placeholder" />
                      <Card.Body className="p-0 ms-3"> {/* Added margin start */}
                        <p>
                          <strong>{username}</strong> {/* Display username from sessionStorage */}
                          <span className="n-time text-muted float-end"> {/* Use float-end */}
                            <i className="icon feather icon-clock me-1" />30 min
                          </span>
                        </p>
                        <p className="mb-0">New ticket Added</p> {/* Added mb-0 */}
                      </Card.Body>
                    </Card>
                  </ListGroup.Item>
                  {/* Earlier Notifications */}
                  <ListGroup.Item as="li" bsPrefix=" " className="n-title"><p className="m-b-0">EARLIER</p></ListGroup.Item>
                  {notiData.map((data, index) => (
                    <ListGroup.Item key={index} as="li" bsPrefix=" " className="notification">
                      <Card className="d-flex align-items-center shadow-none mb-0 p-0 border-0" style={{ flexDirection: 'row', backgroundColor: 'unset' }}>
                        <img className="img-radius" src={data.image} alt="Generic placeholder" />
                        <Card.Body className="p-0 ms-3"> {/* Added margin start */}
                          <p>
                            <strong>{data.name}</strong>
                            <span className="n-time text-muted float-end"> {/* Use float-end */}
                              <i className="icon feather icon-clock me-1" />{data.activity}
                            </span>
                          </p>
                          <p className="mb-0">{data.details}</p> {/* Added mb-0 */}
                        </Card.Body>
                      </Card>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </PerfectScrollbar>
              <div className="noti-footer">
                <Link to="#">show all</Link>
              </div>
            </Dropdown.Menu>
          </Dropdown>
        </ListGroup.Item>

        {/* Chat Dropdown/Button */}
        <ListGroup.Item as="li" bsPrefix=" ">
          <Dropdown>
            <Dropdown.Toggle as={Link} variant="link" to="#" className="displayChatbox" onClick={() => setListOpen(true)}>
              <i className="icon feather icon-mail" />
            </Dropdown.Toggle>
            {/* ChatList component is managed separately */}
          </Dropdown>
        </ListGroup.Item>

        {/* User Profile Dropdown */}
        <ListGroup.Item as="li" bsPrefix=" ">
          <Dropdown align={'end'} className="drp-user">
            <Dropdown.Toggle as={Link} variant="link" to="#" id="dropdown-basic-user"> {/* Added unique ID */}
               <i className="icon feather icon-user" /> {/* Changed to user icon for clarity */}
               {/* Optionally add username text next to icon: <span className="ms-1 d-none d-sm-inline">{username}</span> */}
            </Dropdown.Toggle>
            <Dropdown.Menu align="end" className="profile-notification">
              <div className="pro-head bg-light border-bottom mb-1 pb-2"> {/* Added some styling */}
                <img src={avatar1} className="img-radius me-2" alt="User Profile" /> {/* Added margin */}
                <span className="fw-bold">{username}</span> {/* Display username from sessionStorage */}
                 {/* Optionally add role or email if available and desired */}
                 {/* <span className="d-block text-muted small">{sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE)}</span> */}
              </div>
              <ListGroup as="ul" bsPrefix=" " variant="flush" className="pro-body">
                 {/* Using Dropdown.Item for better semantics and styling */}
                <Dropdown.Item as={Link} to="#">
                   <i className="feather icon-settings me-2" /> Settings
                </Dropdown.Item>
                <Dropdown.Item as={Link} to="/app/userprofile"> {/* Ensure this route matches your setup */}
                   <i className="feather icon-user me-2" /> Profile
                </Dropdown.Item>
                 <Dropdown.Item as={Link} to="#">
                   <i className="feather icon-mail me-2" /> My Messages
                 </Dropdown.Item>
                 <Dropdown.Item as={Link} to="#">
                   <i className="feather icon-lock me-2" /> Lock Screen
                 </Dropdown.Item>
                 <Dropdown.Divider /> {/* Added a divider */}
                 <Dropdown.Item as="button" onClick={handleLogout} className="text-danger">
                   <i className="feather icon-log-out me-2" /> Logout
                 </Dropdown.Item>
               </ListGroup>
            </Dropdown.Menu>
          </Dropdown>
        </ListGroup.Item>
      </ListGroup>
      {/* ChatList Component (remains the same) */}
      <ChatList listOpen={listOpen} closed={() => setListOpen(false)} />
    </React.Fragment>
  );
};

export default NavRight;