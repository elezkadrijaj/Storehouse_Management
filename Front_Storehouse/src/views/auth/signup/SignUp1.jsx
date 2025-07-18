import React, { useState } from 'react';
import { Card, Row, Col, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

import Breadcrumb from '../../../layouts/AdminLayout/Breadcrumb';

const API_AUTH_URL = 'https://localhost:7204/api/Account';

const SignUp1 = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    companyBusinessNumber: '',
    companyName: ''
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await axios.post(`${API_AUTH_URL}/register-company-manager`, formData);
      setSuccess(response.data.message + " You will be redirected to login shortly.");
      setFormData({
        username: '',
        email: '',
        password: '',
        companyBusinessNumber: '',
        companyName: ''
      });

      setTimeout(() => {
        navigate('/auth/signin-1');
      }, 2000);

    } catch (err) {
      console.error("Sign up error:", err.response || err);
      if (err.response && err.response.data) {
        const errorData = err.response.data;
        if (errorData.errors) {
          const messages = Object.values(errorData.errors)
            .flat()
            .map(msg => (typeof msg === 'object' ? msg.description : msg));
          setError(messages.join(' '));
        } else if (errorData.message) {
          setError(errorData.message);
        } else if (typeof errorData === 'string') {
          setError(errorData);
        } else {
          setError("An unknown error occurred during sign up. Please check details and try again.");
        }
      } else if (err.request) {
        setError("Could not connect to the server. Please check your network and try again.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
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
          <Card className="borderless">
            <Row className="align-items-center">
              <Col>
                <Card.Body className="text-center">
                  <div className="mb-4">
                    <i className="feather icon-user-plus auth-icon" />
                  </div>
                  <h3 className="mb-4">Sign up</h3>

                  {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
                  {success && <Alert variant="success">{success}</Alert>}

                  <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Control
                        type="text"
                        name="username"
                        placeholder="Username"
                        value={formData.username}
                        onChange={handleChange}
                        required
                        disabled={isLoading}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Control
                        type="email"
                        name="email"
                        placeholder="Email address (Manager's Email)"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        disabled={isLoading}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Control
                        type="password"
                        name="password"
                        placeholder="Password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        disabled={isLoading}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Control
                        type="text"
                        name="companyName"
                        placeholder="Company Name"
                        value={formData.companyName}
                        onChange={handleChange}
                        required
                        disabled={isLoading}
                      />
                    </Form.Group>

                    <Form.Group className="mb-4">
                      <Form.Control
                        type="text"
                        name="companyBusinessNumber"
                        placeholder="Company Business Number"
                        value={formData.companyBusinessNumber}
                        onChange={handleChange}
                        required
                        disabled={isLoading}
                      />
                    </Form.Group>

                    <div className="form-check text-start mb-4 mt-2">
                      <Form.Check
                        type="checkbox"
                        id="customCheck1"
                        label={
                          <>
                            I agree to the <Link to="#">Terms & Conditions</Link>.
                          </>
                        }
                        required
                      />
                    </div>

                    <Button variant="primary" type="submit" className="mb-4 w-100" disabled={isLoading}>
                      {isLoading ? (
                        <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Signing Up...</>
                      ) : (
                        'Sign up'
                      )}
                    </Button>
                  </Form>

                  <p className="mb-2">
                    Already have an account?{' '}
                    <NavLink to={'/auth/signin-1'} className="f-w-400">
                      Login
                    </NavLink>
                  </p>
                  <p className="mb-0 text-muted">
                    Registering as an employee?{' '}
                    <NavLink to="/auth/register-worker" className="f-w-400">
                      Register Worker
                    </NavLink>
                  </p>
                </Card.Body>
              </Col>
            </Row>
          </Card>
        </div>
      </div>
    </React.Fragment>
  );
};

export default SignUp1;