import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import cookieUtils from 'views/auth/cookieUtils'; // Adjust path if needed
import { useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';

function MyStorehouse() {
    const [storehouseData, setStorehouseData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();


    const API_URL = 'https://localhost:7204/api/Storehouses/my-storehouse-info'; // Use if no proxy or direct call needed

    useEffect(() => {
        const fetchStorehouseData = async () => {
            setIsLoading(true);
            setError(null);
            setStorehouseData(null);

            const token = cookieUtils.getTokenFromCookies();
            // console.log('Token being sent:', token); // Optional: Keep for debugging

            if (!token) {
                setError('Authentication token not found in cookies. Please log in.');
                setIsLoading(false);
                return;
            }

            // console.log('Fetching from URL:', API_URL); // Optional: Keep for debugging

            try {
                const response = await fetch(API_URL, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json', // Good practice
                        'Authorization': `Bearer ${token}`,
                    },
                });

                // console.log('Response Status:', response.status); // Optional: Keep for debugging

                const contentType = response.headers.get('content-type');
                if (!response.ok || !contentType || !contentType.includes('application/json')) {
                    let errorMessage = `Error: ${response.status} ${response.statusText}`;
                    try {
                        const errorText = await response.text();
                        // console.error("Non-JSON Response Body:", errorText); // Optional: Keep for debugging
                        try {
                            // Try parsing anyway, maybe backend sent JSON error despite wrong content type
                            const errorBody = JSON.parse(errorText);
                            errorMessage = errorBody.message || errorBody.title || errorMessage;
                        } catch (parseErr) {
                            // It really wasn't JSON
                            errorMessage = `${errorMessage}. Response likely HTML. Check Network tab.`;
                        }
                    } catch (e) {
                        // Ignore issues reading the error text itself
                    }
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                console.log("API Data Received:", data); // Log to verify structure
                setStorehouseData(data);

            } catch (err) {
                console.error("Failed to fetch storehouse data:", err);
                setError(err.message || 'Failed to fetch data. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchStorehouseData();
    }, [API_URL]); // Effect depends only on API_URL

    const handleViewSections = () => {
        console.log("MyStorehouse - handleViewSections clicked. Current storehouseData:", JSON.stringify(storehouseData, null, 2)); // <-- VIEW THIS LOG

        if (storehouseData && storehouseData.storehouseId && storehouseData.storehouseId > 0) { // <-- Check this property name against the log above
            const id = storehouseData.storehouseId; // <-- Check this property name
            console.log("MyStorehouse - Navigating with ID:", id);
            navigate(`/app/sections?storehouseId=${id}`);
        } else {
            console.error("MyStorehouse - Cannot navigate: Storehouse ID is not available or invalid in", storehouseData);
            setError("Could not retrieve a valid Storehouse ID to view sections.");
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="alert alert-danger d-flex align-items-center" role="alert">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-exclamation-triangle-fill flex-shrink-0 me-2" viewBox="0 0 16 16" role="img" aria-label="Warning:">
                        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
                    </svg>
                    <div>
                        <strong>Error:</strong> {error}
                    </div>
                </div>
            );
        }

        // Only render the card if storehouseData is truthy
        if (storehouseData) {
            return (
                <div className="card shadow-sm">
                    <div className="card-header bg-primary text-white">
                        <h5 className="mb-0 d-flex align-items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-house-gear-fill me-2" viewBox="0 0 16 16">
                                <path d="M7.293 1.5a1 1 0 0 1 1.414 0L11 3.793V2.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v3.293l2.354 2.353a.5.5 0 0 1-.708.708L8 5.207 1.354 11.854a.5.5 0 1 1-.708-.708z" />
                                <path d="M11.07 9.047a1.5 1.5 0 0 0-1.742.26l-.02.021a1.5 1.5 0 0 0-.26 1.742 1.5 1.5 0 0 0 1.742-.26l.02-.022a1.5 1.5 0 0 0 .26-1.742m-2.48 4.31a1.5 1.5 0 0 0-1.742-.26l-.02.022a1.5 1.5 0 0 0-.26 1.741 1.5 1.5 0 0 0 1.742.26l.02-.021a1.5 1.5 0 0 0 .26-1.741m4.256 a1.5 1.5 0 0 0-1.742-.26l-.02.022a1.5 1.5 0 0 0-.26 1.741 1.5 1.5 0 0 0 1.742.26l.02-.021a1.5 1.5 0 0 0 .26-1.741m-1.55-5.487a.5.5 0 0 0-.488.6c.051.138.103.28.157.425l-1.377.612a.5.5 0 1 0 .433.918l1.742-.774a2.5 2.5 0 1 0 .012-1.81.5.5 0 0 0-.554-.03zm-4.59.218a2.5 2.5 0 1 0 2.5 0 2.5 2.5 0 0 0-2.5 0m.143.996a1.5 1.5 0 1 1 .001-3.001 1.5 1.5 0 0 1-.001 3.001" />
                                <path d="M12.5 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7m.5-5v1h1a.5.5 0 0 1 0 1h-1v1a.5.5 0 1 1-1 0v-1h-1a.5.5 0 1 1 0-1h1v-1a.5.5 0 0 1 1 0" />
                            </svg>
                            Storehouse Details
                        </h5>
                    </div>
                    <div className="card-body">
                        {/* Display all relevant Storehouse details */}
                        <div className="mb-3 row">
                            <strong className="col-sm-4 col-form-label">Name:</strong>
                            <div className="col-sm-8">
                                <p className="form-control-plaintext">{storehouseData.name || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="mb-3 row">
                            <strong className="col-sm-4 col-form-label">Address / Location:</strong>
                            <div className="col-sm-8">
                                <p className="form-control-plaintext">{storehouseData.address || 'N/A'}</p>
                            </div>
                        </div>
                        

                        {/* View Sections Button Area */}
                        <div className="mt-3 d-flex justify-content-end">
                            <Button
                                variant="info"
                                onClick={handleViewSections}
                            // disabled={!storehouseData.storehouseId || storehouseData.storehouseId <= 0} // <-- Comment out or remove for testing
                            // title={!storehouseData.storehouseId || storehouseData.storehouseId <= 0 ? "Storehouse ID not available" : "View sections for this storehouse"} // <-- Can remove title too for now
                            >
                                {/* ... icon ... */}
                                View Sections
                            </Button>
                        </div>
                    </div>
                    <div className="card-footer text-muted">
                        Information retrieved based on your access token.
                    </div>
                </div>
            );
        }

        // Fallback if not loading, no error, but no data (should ideally not happen if API call works)
        return <p>No storehouse data available or component state issue.</p>;
    };

    return (
        <div className="container mt-4">
            <h1 className="mb-4">My Storehouse Information</h1>
            {renderContent()}
        </div>
    );
}

export default MyStorehouse;