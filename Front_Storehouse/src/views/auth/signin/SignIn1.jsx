import React, { useState } from 'react';
import axios from 'axios';
import { NavLink, useNavigate } from 'react-router-dom';
import { Card, Button, Form, Alert } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Breadcrumb from '../../../layouts/AdminLayout/Breadcrumb';
import cookieUtils from '../cookieUtils';

export const LoginEndPoint = `https://localhost:7204/api/Account/login`;

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

    try {
      const response = await axios.post(LoginEndPoint, {
        username: username,
        password: password,
      });

      if (response.status === 200) {
        const { token, refreshToken } = response.data;

        const parsedToken = parseJwt(token); 
        console.log('Token:', parsedToken)

        if (parsedToken) {
          const role = parsedToken['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
          const userId = parsedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
          const name = parsedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];

          cookieUtils.setTokenCookies(token);
          cookieUtils.setRefreshToken(refreshToken);
          cookieUtils.setUserIdInCookies(userId);
          cookieUtils.setUserRoleInCookies(role);
          cookieUtils.setNameInCookies(name);

          cookieUtils.startRefreshingToken();

          console.log('User data after login:');
          console.log('User ID:', userId);
          console.log('User Role:', role);
          console.log('User Name:', name);

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
      setError(
        err.response?.data?.message || 'An unexpected error occurred.'
      );
      toast.error(
        err.response?.data?.message || 'An unexpected error occurred.'
      );
    } finally {
      setLoading(false);
    }
  };

  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
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
            <span className="r" />
            <span className="r s" />
            <span className="r s" />
            <span className="r" />
          </div>
          <Card className="borderless text-center">
            <Card.Body>
              <div className="mb-4">
                <i className="feather icon-unlock auth-icon" />
              </div>
              <Form onSubmit={handleSubmit}>
                {error && <Alert variant="danger">{error}</Alert>}
                <Form.Group size="lg" controlId="username">
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </Form.Group>
                <Form.Group size="lg" controlId="password">
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Form.Group>
                <Button block size="lg" type="submit" disabled={loading}>
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </Form>
              <p className="mb-2 text-muted">
                Forgot password?
                <NavLink to={'#'} className="f-w-400">
                  Reset
                </NavLink>
              </p>
              <p className="mb-0 text-muted">
                Don’t have an account?
                <NavLink to="/auth/signup-1" className="f-w-400">
                  Signup
                </NavLink>
              </p>
              <Alert variant="primary" className="text-start mt-3">
                User:
              </Alert>
            </Card.Body>
          </Card>
        </div>
      </div>
      <ToastContainer />
    </React.Fragment>
  );
};

export default Signin1;