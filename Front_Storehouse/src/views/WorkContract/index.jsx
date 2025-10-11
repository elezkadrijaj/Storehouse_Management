import React, { useState, useEffect } from 'react';
import apiClient from '../../appService'; // REFACTORED: Import the centralized apiClient

// Note: The direct import for 'axios' and the API_BASE_URL constant have been removed.

// Consistent session storage keys
const SESSION_STORAGE_KEYS = {
  TOKEN: 'authToken',
  USER_ID: 'userId',
};

function MyWorkContract() {
  // --- All state hooks remain the same ---
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWorkContract = async () => {
      setLoading(true);
      setError(null);
      setContract(null);

      const userId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);
      const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN); // Get the auth token

      if (!userId || !token) {
        setError('User session information not found. Please log in.');
        setLoading(false);
        return;
      }

      try {
        console.log(`Fetching work contract for user ID: ${userId}`);

        // REFACTORED: Use apiClient, a relative URL, and include the auth token.
        const response = await apiClient.get(`/WorkContract/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Work contract data received:', response.data);
        setContract(response.data);

      } catch (err) {
        console.error("Error fetching work contract:", err);
        // REFACTORED: Simplified error handling for axios's structure.
        const serverMessage = err.response?.data?.message || err.response?.data;
        let errorMessage = 'An unexpected error occurred.';

        if (err.response?.status === 404) {
            errorMessage = serverMessage || `No work contract found for your user ID.`;
        } else {
            errorMessage = serverMessage || err.message;
        }
        
        setError(errorMessage);
        setContract(null);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkContract();
  }, []); // Runs once on component mount

  // --- The entire return JSX remains exactly the same ---
  return (
    <div className="container mt-4">
      {loading && (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <span className="ms-3">Loading your work contract...</span>
        </div>
      )}

      {error && !loading && (
        <div className="alert alert-danger" role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}

      {contract && !loading && !error && (
        <div className="card shadow-sm">
          <div className="card-header bg-primary text-white">
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
                {contract.endDate ? new Date(contract.endDate).toLocaleDateString() : <span className="text-muted">Active</span>}
              </dd>

              <dt className="col-sm-4">Salary:</dt>
              <dd className="col-sm-8">
                {contract.salary ? contract.salary.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : <span className="text-muted">N/A</span>}
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

      {!loading && !error && !contract && (
         <div className="alert alert-info" role="alert">
             No work contract information is currently available for you.
         </div>
      )}
    </div>
  );
}

export default MyWorkContract;