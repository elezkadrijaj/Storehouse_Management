import React, { useState } from 'react';
import axios from 'axios';
import { NavLink, useNavigate } from 'react-router-dom';
import { Card, Button, Form, Alert } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Breadcrumb from '../../../layouts/AdminLayout/Breadcrumb';
import cookieUtils from '../cookieUtils';

export const LoginEndPoint = `https://localhost:7204/api/Account/login`;

const SESSION_STORAGE_KEYS = {
  TOKEN: 'authToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_ID: 'userId',
  USER_ROLE: 'userRole',
  USER_NAME: 'userName',
};

const setSessionItem = (key, value) => sessionStorage.setItem(key, value);
const removeSessionItem = (key) => sessionStorage.removeItem(key);

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

    Object.values(SESSION_STORAGE_KEYS).forEach(key => removeSessionItem(key));

    try {
      const response = await axios.post(LoginEndPoint, {
        username: username,
        password: password,
      });

      if (response.status === 200) {
        const { token, refreshToken } = response.data;
        const parsedToken = parseJwt(token);

        if (parsedToken) {
          const role = parsedToken['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
          const userId = parsedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
          
          // =================== THIS IS THE FIX ===================
          // We change `parsedToken.sub` to `parsedToken.name` to get the actual username.
          const name = parsedToken.name;
          // =======================================================
          
          const companyId = parsedToken.companiesId;

          setSessionItem(SESSION_STORAGE_KEYS.TOKEN, token);
          setSessionItem(SESSION_STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
          setSessionItem(SESSION_STORAGE_KEYS.USER_ID, userId);
          setSessionItem(SESSION_STORAGE_KEYS.USER_ROLE, role);
          setSessionItem(SESSION_STORAGE_KEYS.USER_NAME, name);
          cookieUtils.setNameInCookies(name);
          cookieUtils.setCompanyIdInCookies(companyId);

          console.warn("TODO: Implement token refresh logic using sessionStorage!");

          toast.success('Login successful!');

          if (role === 'Admin') {
            navigate('/dashboard');
          } else {
            navigate('/app/home');
          }
        } else {
          setError('Failed to parse the token.');
          toast.error('Failed to parse the token.');
        }
      } else {
        setError(response.data?.message || 'Login failed. Please check your credentials.');
        toast.error(response.data?.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'An unexpected error occurred during login.';
      setError(errorMessage);
      toast.error(errorMessage);
      Object.values(SESSION_STORAGE_KEYS).forEach(key => removeSessionItem(key));
    } finally {
      setLoading(false);
    }
  };

  const parseJwt = (token) => {
    try {
      if (!token) return null;
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
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
      return null;
    }
  };

  return (
    <React.Fragment>
      <Breadcrumb />
      <div className="auth-wrapper">
        <div className="auth-content">
          <div className="auth-bg">
            <span className="r" /> <span className="r s" /> <span className="r s" /> <span className="r" />
          </div>
          <Card className="borderless text-center">
            <Card.Body>
              <div className="mb-4">
                <i className="feather icon-unlock auth-icon" />
              </div>
              <h3 className="mb-4">Login</h3>
              <Form onSubmit={handleSubmit}>
                {error && <Alert variant="danger">{error}</Alert>}
                <Form.Group className="mb-3" size="lg" controlId="username">
                  <Form.Control
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    aria-label="Username"
                  />
                </Form.Group>
                <Form.Group className="mb-4" size="lg" controlId="password">
                  <Form.Control
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    aria-label="Password"
                  />
                </Form.Group>
                <Button className="btn-block mb-4" size="lg" type="submit" disabled={loading}>
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </Form>
              <p className="mb-2 text-muted">
                Forgot password?{' '}
                <NavLink to={'#'} className="f-w-400">
                  Reset
                </NavLink>
              </p>
              <p className="mb-2 text-muted">
                Register Company?{' '}
                <NavLink to="/auth/signup-1" className="f-w-400">
                  Signup
                </NavLink>
              </p>
              <p className="mb-0 text-muted">
                Register as a{' '}
                <NavLink to="/auth/register-worker" className="f-w-400">
                  Worker
                </NavLink>
              </p>
            </Card.Body>
          </Card>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    </React.Fragment>
  );
};

export default Signin1;