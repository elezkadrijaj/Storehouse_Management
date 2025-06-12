import React, { useState } from 'react';
import { Card, Row, Col, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { NavLink, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_AUTH_URL = 'https://localhost:7204/api/Account';

const RegisterWorker = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    companyBusinessNumber: '',
    storehouseName: ''
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
      const response = await axios.post(`${API_AUTH_URL}/register-worker`, formData);
      setSuccess(response.data.message);
      setFormData({
        username: '',
        email: '',
        password: '',
        companyBusinessNumber: '',
        storehouseName: ''
      });

      setTimeout(() => {
        navigate('/auth/signin-1');
      }, 3000);

    } catch (err) {
      console.error("Worker registration error:", err.response || err);
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
          setError("An unknown error occurred. Please check your details and try again.");
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
                  <h3 className="mb-4">Register Worker</h3>

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
                        placeholder="Email address"
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
                        name="companyBusinessNumber"
                        placeholder="Company Business Number"
                        value={formData.companyBusinessNumber}
                        onChange={handleChange}
                        required
                        disabled={isLoading}
                      />
                    </Form.Group>
                    
                    <Form.Group className="mb-4">
                      <Form.Control
                        type="text"
                        name="storehouseName"
                        placeholder="Storehouse Name"
                        value={formData.storehouseName}
                        onChange={handleChange}
                        required
                        disabled={isLoading}
                      />
                    </Form.Group>

                    <Button variant="primary" type="submit" className="mb-4 w-100" disabled={isLoading}>
                      {isLoading ? (
                        <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Registering...</>
                      ) : (
                        'Register Worker'
                      )}
                    </Button>
                  </Form>

                  <p className="mb-2">
                    Already have an account?{' '}
                    <NavLink to={'/auth/signin-1'} className="f-w-400">
                      Login
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

export default RegisterWorker;