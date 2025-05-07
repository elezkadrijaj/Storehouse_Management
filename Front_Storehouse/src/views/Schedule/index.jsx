import React, { useState, useEffect } from 'react';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils'; // Adjust path if needed

// --- Configuration ---
// IMPORTANT: Replace with your actual backend API base URL for schedules
const API_BASE_URL = 'https://localhost:7204/api/Schedule'; // Example: Adjust if needed

const SESSION_STORAGE_KEYS = {
  TOKEN: 'authToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_ID: 'userId',
  USER_ROLE: 'userRole', 
  USER_NAME: 'userName', 
};

function MySchedule() {
  // State variables
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);
      setError(null);
      setSchedule(null);

      const userId =sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);

      if (!userId) {
        setError('User ID not found in cookies. Please log in.');
        setLoading(false);
        return;
      }

      const apiUrl = `${API_BASE_URL}/user/${userId}`;

      try {
        console.log(`Fetching schedule from: ${apiUrl}`);
        const response = await axios.get(apiUrl);
        console.log('Schedule data received:', response.data);
        setSchedule(response.data);

      } catch (err) {
        console.error("Error fetching schedule:", err);

        if (err.response) {
          if (err.response.status === 404) {
            // Use the backend message or a default
            setError(err.response.data || `No schedule found for user ID ${userId}.`);
          } else if (err.response.status === 400) {
             setError(`Error fetching schedule: ${err.response.data || 'Bad Request'}`);
          }
           else {
            setError(`Server error: ${err.response.status} - ${err.response.data?.title || err.response.statusText || 'An unexpected error occurred'}`);
          }
        } else if (err.request) {
          setError('Network Error: Could not connect to the server. Is the backend running?');
        } else {
          setError(`Error: ${err.message}`);
        }
        setSchedule(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Render Logic with Bootstrap ---

  return (
    // Add a container for padding and alignment
    <div className="container mt-4">

      {/* --- Loading State --- */}
      {loading && (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <span className="ms-3">Loading your schedule...</span>
        </div>
      )}

      {/* --- Error State --- */}
      {error && !loading && (
        <div className="alert alert-danger" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* --- Schedule Display State --- */}
      {schedule && !loading && !error && (
        <div className="card shadow-sm"> {/* Use a card for better presentation */}
          <div className="card-header">
             <h2 className="mb-0">Your Schedule</h2> {/* Use card-header for title */}
          </div>
          <div className="card-body">
            {/*
              IMPORTANT: Adjust the properties below (id, title, description, etc.)
              to match your actual Schedule object from the backend API.
            */}
            <dl className="row mb-0"> {/* Use definition list for key-value pairs */}
               {/* Only show ID if it exists and is meaningful */}
              {schedule.id && (
                <>
                  <dt className="col-sm-3">Schedule ID:</dt>
                  <dd className="col-sm-9">{schedule.id}</dd>
                </>
              )}

              <dt className="col-sm-3">User ID:</dt>
              <dd className="col-sm-9">{schedule.userId || 'N/A'}</dd>

              <dt className="col-sm-3">Title:</dt>
              <dd className="col-sm-9">{schedule.title || <span className="text-muted">No title provided</span>}</dd>

              <dt className="col-sm-3">Description:</dt>
              <dd className="col-sm-9">{schedule.description || <span className="text-muted">No description provided</span>}</dd>

              <dt className="col-sm-3">Start Time:</dt>
              <dd className="col-sm-9">{schedule.startDate ? new String(schedule.startDate).toLocaleString() : <span className="text-muted">N/A</span>}</dd>

              <dt className="col-sm-3">End Time:</dt>
              <dd className="col-sm-9">{schedule.endDate ? new String(schedule.endDate).toLocaleString() : <span className="text-muted">N/A</span>}</dd>

              <dt className="col-sm-3">End Time:</dt>
              <dd className="col-sm-9">{schedule.breakTime ? new String(schedule.breakTime).toLocaleString() : <span className="text-muted">N/A</span>}</dd>
              {/* Add more fields relevant to your Schedule model following the dl/dt/dd pattern */}
            </dl>

             {/* Optional: Display raw data for debugging (inside a collapsible element) */}
             {/*
             <div className="mt-4">
                <button className="btn btn-outline-secondary btn-sm" type="button" data-bs-toggle="collapse" data-bs-target="#scheduleRawData" aria-expanded="false" aria-controls="scheduleRawData">
                    Show Raw Data (Debug)
                </button>
                <div className="collapse mt-2" id="scheduleRawData">
                    <pre className="bg-light p-3 rounded small">
                        <code>{JSON.stringify(schedule, null, 2)}</code>
                    </pre>
                </div>
             </div>
             */}
          </div>
        </div>
      )}

      {/* --- Fallback/Empty State (if not loading, no error, but no schedule - primarily for the 404 case handled by error now) --- */}
      {/* This state might not be reached if 404s correctly set the error state */}
      {!loading && !error && !schedule && (
         <div className="alert alert-info" role="alert">
             No schedule information is currently available for you.
         </div>
      )}

    </div> // End container
  );
}

export default MySchedule;