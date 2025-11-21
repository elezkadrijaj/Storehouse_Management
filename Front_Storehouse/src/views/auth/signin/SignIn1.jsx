import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Card, Button, Form, Alert } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import apiClient from '../../../appService';

import Breadcrumb from '../../../layouts/AdminLayout/Breadcrumb';

const SESSION_STORAGE_KEYS = {
  USER_ID: 'userId',
  USER_ROLE: 'userRole',
  USER_NAME: 'userName',
  BUSINESS_NUMBER: 'companyBusinessNumber'
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
      const response = await apiClient.post('/Account/login', {
        username: username,
        password: password,
      });

      if (response.status === 200 && response.data) {
        const { userId, username: name, role, companyBusinessNumber } = response.data;

        // Check if all necessary data was received from the server
        if (userId && name && role) {
          // --- ALL SUCCESS LOGIC NOW GOES INSIDE THIS BLOCK ---
          
          // 1. Store user info in session storage
          setSessionItem(SESSION_STORAGE_KEYS.USER_ID, userId);
          setSessionItem(SESSION_STORAGE_KEYS.USER_ROLE, role);
          setSessionItem(SESSION_STORAGE_KEYS.USER_NAME, name);
          if (companyBusinessNumber) {
              setSessionItem(SESSION_STORAGE_KEYS.BUSINESS_NUMBER, companyBusinessNumber);
          }
          
          toast.success('Login successful! Redirecting...');

          // 2. Perform navigation only on success
          if (role === 'Admin') {
            navigate('/dashboard');
          } else {
            // This handles CompanyManager, StorehouseManager, Worker, etc.
            navigate('/app/home'); 
          }
          
        } else {
          // This block runs if the data from the server is incomplete
          const errorMessage = 'Login failed: Incomplete user data received from server.';
          setError(errorMessage);
          toast.error(errorMessage);
        }
      } else {
        // This handles cases where status might be 200 but data is empty
        const errorMessage = 'Login failed: Invalid response from server.';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'An unexpected error occurred.';
      setError(errorMessage);
      toast.error(errorMessage);
      Object.values(SESSION_STORAGE_KEYS).forEach(key => removeSessionItem(key));
    } finally {
      setLoading(false);
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
                  <Form.Control type="text" placeholder="Enter username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </Form.Group>
                <Form.Group className="mb-4" size="lg" controlId="password">
                  <Form.Control type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Form.Group>
                <Button className="btn-block mb-4" size="lg" type="submit" disabled={loading}>
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </Form>
              <p className="mb-2 text-muted">Forgot password? <NavLink to={'#'} className="f-w-400">Reset</NavLink></p>
              <p className="mb-2 text-muted">Register Company? <NavLink to="/auth/signup-1" className="f-w-400">Signup</NavLink></p>
              <p className="mb-0 text-muted">Register as a <NavLink to="/auth/register-worker" className="f-w-400">Worker</NavLink></p>
            </Card.Body>
          </Card>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </React.Fragment>
  );
};

export default Signin1;