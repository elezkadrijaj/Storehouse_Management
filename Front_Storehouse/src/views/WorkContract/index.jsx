// src/views/your-feature-folder/MyWorkContract.js (adjust path as needed)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
// Assuming cookieUtils is for auth tokens, not directly used here for userId
// import cookieUtils from 'views/auth/cookieUtils'; 

// --- Configuration ---
// IMPORTANT: Replace with your actual backend API base URL
const API_BASE_URL = 'https://localhost:7204/api/WorkContract'; // Your API base URL for WorkContract

// Consistent session storage keys
const SESSION_STORAGE_KEYS = {
  TOKEN: 'authToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_ID: 'userId', // This is the key we'll use
  USER_ROLE: 'userRole',
  USER_NAME: 'userName',
};

function MyWorkContract() {
  // State variables
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWorkContract = async () => {
      setLoading(true);
      setError(null);
      setContract(null); // Clear previous contract data

      const userId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);

      if (!userId) {
        setError('User ID not found in session storage. Please log in.');
        setLoading(false);
        return;
      }

      // Use the new endpoint: /api/WorkContract/user/{userId}
      const apiUrl = `${API_BASE_URL}/user/${userId}`;

      try {
        console.log(`Fetching work contract from: ${apiUrl}`);
        // You might need to pass an auth token if your API is secured
        // const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
        // const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        // const response = await axios.get(apiUrl, config);
        const response = await axios.get(apiUrl); // Assuming public or session-based auth for now

        console.log('Work contract data received:', response.data);
        setContract(response.data);

      } catch (err) {
        console.error("Error fetching work contract:", err);
        let errorMessage = 'An unexpected error occurred while fetching your work contract.';
        if (err.response) {
          // err.response.data might be an object like { message: "..." } or just a string
          const serverMessage = err.response.data?.message || err.response.data;
          if (err.response.status === 404) {
            errorMessage = serverMessage || `No work contract found for your user ID.`;
          } else if (err.response.status === 400) {
            errorMessage = `Error fetching contract: ${serverMessage || 'Bad Request'}`;
          } else {
            errorMessage = `Server error: ${err.response.status} - ${serverMessage || err.response.statusText}`;
          }
        } else if (err.request) {
          errorMessage = 'Network Error: Could not connect to the server. Please check your connection and if the backend is running.';
        } else {
          errorMessage = `Error: ${err.message}`;
        }
        setError(errorMessage);
        setContract(null);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkContract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once on component mount

  // --- Render Logic with Bootstrap ---
  return (
    <div className="container mt-4">
      {/* --- Loading State --- */}
      {loading && (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <span className="ms-3">Loading your work contract...</span>
        </div>
      )}

      {/* --- Error State --- */}
      {error && !loading && (
        <div className="alert alert-danger" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* --- Work Contract Display State --- */}
      {contract && !loading && !error && (
        <div className="card shadow-sm">
          <div className="card-header bg-primary text-white"> {/* Added some color */}
            <h2 className="mb-0 h4">Your Work Contract Details</h2>
          </div>
          <div className="card-body">
            <dl className="row mb-0">
              <dt className="col-sm-4">Contract ID:</dt>
              <dd className="col-sm-8">{contract.workContractId}</dd>

              <dt className="col-sm-4">Employee User ID:</dt>
              <dd className="col-sm-8">{contract.userId}</dd>

              <dt className="col-sm-4">Start Date:</dt>
              <dd className="col-sm-8">
                {contract.startDate ? new Date(contract.startDate).toLocaleDateString() : <span className="text-muted">N/A</span>}
              </dd>

              <dt className="col-sm-4">End Date:</dt>
              <dd className="col-sm-8">
                {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : <span className="text-muted">N/A</span>}
              </dd>

              <dt className="col-sm-4">Salary:</dt>
              <dd className="col-sm-8">
                {contract.salary ? contract.salary.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : <span className="text-muted">N/A</span>}
                {/* Adjust currency code (e.g., 'EUR', 'GBP') as needed */}
              </dd>

              <dt className="col-sm-4">Contract Document:</dt>
              <dd className="col-sm-8">
                {contract.contractFileUrl ? (
                  <a href={contract.contractFileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm">
                    View/Download Contract
                  </a>
                ) : (
                  <span className="text-muted">No document URL provided</span>
                )}
              </dd>
            </dl>
          </div>
          <div className="card-footer text-muted small">
            Contract information retrieved at: {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* --- Fallback/Empty State (if not loading, no error, but no contract - primarily for 404 handled by error) --- */}
      {!loading && !error && !contract && (
         <div className="alert alert-info" role="alert">
             No work contract information is currently available for you.
         </div>
      )}
    </div>
  );
}

export default MyWorkContract;