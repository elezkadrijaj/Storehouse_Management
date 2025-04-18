import React, { useState } from 'react';
import axios from 'axios';
import { NavLink, useNavigate } from 'react-router-dom';
import { Card, Button, Form, Alert } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Breadcrumb from '../../../layouts/AdminLayout/Breadcrumb';
import cookieUtils from '../cookieUtils';
// import cookieUtils from '../cookieUtils'; // No longer using cookieUtils here for setting auth state

export const LoginEndPoint = `https://localhost:7204/api/Account/login`;

// --- Define Keys for Session Storage ---
const SESSION_STORAGE_KEYS = {
  TOKEN: 'authToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_ID: 'userId',
  USER_ROLE: 'userRole',
  USER_NAME: 'userName',
};
// --- Helper Functions for Session Storage (Optional but recommended) ---
const setSessionItem = (key, value) => sessionStorage.setItem(key, value);
const removeSessionItem = (key) => sessionStorage.removeItem(key);
// You'll need corresponding getSessionItem(key) functions elsewhere in your app

const Signin1 = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    // Clear previous session data for this tab before attempting login
    Object.values(SESSION_STORAGE_KEYS).forEach(key => removeSessionItem(key));

    try {
      const response = await axios.post(LoginEndPoint, {
        username: username,
        password: password,
      });

      if (response.status === 200) {
        const { token, refreshToken } = response.data;

        const parsedToken = parseJwt(token);
        console.log('Parsed Token:', parsedToken) // Keep for debugging if needed

        if (parsedToken) {
          // Extract data from the parsed token
          const role = parsedToken['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
          const userId = parsedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
          const name = parsedToken.sub; // 'sub' often holds the username or unique identifier

          // --- Store data in sessionStorage ---
          setSessionItem(SESSION_STORAGE_KEYS.TOKEN, token);
          setSessionItem(SESSION_STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
          setSessionItem(SESSION_STORAGE_KEYS.USER_ID, userId);
          setSessionItem(SESSION_STORAGE_KEYS.USER_ROLE, role);
          setSessionItem(SESSION_STORAGE_KEYS.USER_NAME, name);
          cookieUtils. setNameInCookies(name); // Optional: Store in cookies if needed

          // --- IMPORTANT: Token Refresh Logic Needs Update ---
          // cookieUtils.startRefreshingToken(); // COMMENTED OUT - You need to replace this
          // TODO: Implement or call a function that starts token refreshing
          //       using the refreshToken stored in sessionStorage.
          //       Example: startSessionTokenRefresh();
          console.warn("TODO: Implement token refresh logic using sessionStorage!");
          // --- End Token Refresh ---


          console.log('User data stored in sessionStorage:');
          console.log('User ID:', userId);
          console.log('User Role:', role);
          console.log('User Name:', name);

          toast.success('Login successful!');

          // Navigate based on role
          if (role === 'Admin') {
            navigate('/dashboard');
          } else {
            // Adjust this path if non-admin users go elsewhere
            navigate('/app/home');
          }
        } else {
          setError('Failed to parse the token.');
          toast.error('Failed to parse the token.');
        }
      } else {
        // Handle non-200 success responses if your API uses them
        setError(
          response.data?.message ||
            'Login failed. Please check your credentials.'
        );
        toast.error(
          response.data?.message ||
            'Login failed. Please check your credentials.'
        );
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'An unexpected error occurred during login.';
      setError(errorMessage);
      toast.error(errorMessage);
       // Clear any potentially partially stored session data on error
       Object.values(SESSION_STORAGE_KEYS).forEach(key => removeSessionItem(key));
    } finally {
      setLoading(false);
    }
  };

  // JWT parsing function (remains the same)
  const parseJwt = (token) => {
    try {
      if (!token) return null; // Handle cases where token might be undefined/null
      const base64Url = token.split('.')[1];
      if (!base64Url) return null; // Invalid token format
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Error parsing JWT token:', e);
      return null; // Return null if parsing fails
    }
  };

  // --- Component Return (JSX remains largely the same) ---
  return (
    <React.Fragment>
      <Breadcrumb />
      <div className="auth-wrapper">
        <div className="auth-content">
          {/* Background spans */}
          <div className="auth-bg">
            <span className="r" /> <span className="r s" /> <span className="r s" /> <span className="r" />
          </div>
          <Card className="borderless text-center">
            <Card.Body>
              <div className="mb-4">
                <i className="feather icon-unlock auth-icon" />
              </div>
              <h3 className="mb-4">Login</h3> {/* Added title */}
              <Form onSubmit={handleSubmit}>
                {error && <Alert variant="danger">{error}</Alert>}
                <Form.Group className="mb-3" size="lg" controlId="username"> {/* Added mb-3 */}
                  {/* <Form.Label>Username</Form.Label> */} {/* Removed label for placeholder focus */}
                  <Form.Control
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    aria-label="Username"
                  />
                </Form.Group>
                <Form.Group className="mb-4" size="lg" controlId="password"> {/* Added mb-4 */}
                 {/* <Form.Label>Password</Form.Label> */} {/* Removed label for placeholder focus */}
                  <Form.Control
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    aria-label="Password"
                  />
                </Form.Group>
                <Button className="btn-block mb-4" size="lg" type="submit" disabled={loading}> {/* Added mb-4 */}
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </Form>
              <p className="mb-2 text-muted">
                Forgot password?{' '}
                <NavLink to={'#'} className="f-w-400">
                  Reset
                </NavLink>
              </p>
              <p className="mb-0 text-muted">
                Don’t have an account?{' '}
                <NavLink to="/auth/signup-1" className="f-w-400">
                  Signup
                </NavLink>
              </p>
              {/* Removed the static Alert box */}
            </Card.Body>
          </Card>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    </React.Fragment>
  );
};

export default Signin1;