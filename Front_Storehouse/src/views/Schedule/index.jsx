import React, { useState, useEffect, useCallback } from 'react';
import { Spinner, Alert, Card, Row, Col, Badge } from 'react-bootstrap';
import axios from 'axios';

import 'bootstrap/dist/css/bootstrap.min.css';


const API_BASE_URL = 'https://localhost:7204/api/Schedule';

const SESSION_STORAGE_KEYS = {
  TOKEN: 'authToken',
  USER_ID: 'userId',
};

function MySchedule() {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
  const userId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!token || !userId) {
      setError('User session not found. Please log in again.');
      setLoading(false);
      return;
    }

    const apiUrl = `${API_BASE_URL}/user/${userId}`;

    try {
      console.log(`Fetching schedule from: ${apiUrl}`);

      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Schedule data received:', response.data);
      setSchedule(response.data);

    } catch (err) {
      console.error("Error fetching schedule:", err);

      if (err.response) {
        if (err.response.status === 404) {
          setError(err.response.data || `No schedule has been assigned to you yet.`);
        } else {
          setError(`Server error: ${err.response.status} - ${err.response.data?.message || 'An unexpected error occurred'}`);
        }
      } else if (err.request) {
        setError('Network Error: Could not connect to the server.');
      } else {
        setError(`An error occurred: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);


  return (
    <div className="container mt-4">
      <h1 className="mb-4">My Weekly Schedule</h1>

      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading your schedule...</p>
        </div>
      )}

      {error && !loading && (
        <Alert variant={error.includes("No schedule has been assigned") ? "info" : "danger"}>
          {error}
        </Alert>
      )}

      {schedule && !loading && !error && (
        <Card className="shadow-sm">
          <Card.Header as="h5" className="bg-success text-white">
            Your Assigned Work Times
          </Card.Header>
          <Card.Body>
            <dl className="row mb-0">
              <dt className="col-sm-3 fs-5">Start Time:</dt>
              <dd className="col-sm-9 fs-5">
                <Badge bg="light" text="dark" className="p-2">{schedule.startDate || 'N/A'}</Badge>
              </dd>

              <hr className="my-3" />

              <dt className="col-sm-3 fs-5">End Time:</dt>
              <dd className="col-sm-9 fs-5">
                <Badge bg="light" text="dark" className="p-2">{schedule.endDate || 'N/A'}</Badge>
              </dd>

              <hr className="my-3" />

              <dt className="col-sm-3 fs-5">Break Time:</dt>
              <dd className="col-sm-9 fs-5">
                <Badge bg="light" text="dark" className="p-2">{schedule.breakTime || 'N/A'}</Badge>
              </dd>
            </dl>
          </Card.Body>
           <Card.Footer className="text-muted small">
             This schedule is assigned by your manager. Please contact them for any changes.
          </Card.Footer>
        </Card>
      )}
    </div>
  );
}

export default MySchedule;