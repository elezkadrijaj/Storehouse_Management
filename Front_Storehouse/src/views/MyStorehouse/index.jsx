import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import cookieUtils from 'views/auth/cookieUtils'; // Adjust path if needed
import { useNavigate } from 'react-router-dom';
import { Button, Spinner, Alert, Card } from 'react-bootstrap'; // Added Card for better structure

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole', 
    USER_NAME: 'userName', 
};

function MyStorehouse() {
    const [storehouseData, setStorehouseData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    // Make sure this URL is correct
    const API_URL = 'https://localhost:7204/api/Storehouses/my-storehouse-info';

    useEffect(() => {
        const fetchStorehouseData = async () => {
            setIsLoading(true);
            setError(null);
            setStorehouseData(null);

            const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
            // console.log('Token being sent:', token);

            if (!token) {
                setError('Authentication token not found in cookies. Please log in.');
                setIsLoading(false);
                return;
            }

            // console.log('Fetching from URL:', API_URL);

            try {
                const response = await fetch(API_URL, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                });

                // console.log('Response Status:', response.status);

                const contentType = response.headers.get('content-type');
                if (!response.ok || !contentType || !contentType.includes('application/json')) {
                    let errorMessage = `Error: ${response.status} ${response.statusText}`;
                    try {
                        const errorText = await response.text();
                        // console.error("Non-JSON Response Body:", errorText);
                        try {
                            const errorBody = JSON.parse(errorText);
                            errorMessage = errorBody.message || errorBody.title || errorMessage;
                        } catch (parseErr) {
                            errorMessage = `${errorMessage}. Response may not be JSON. Check Network tab for details.`;
                        }
                    } catch (e) { /* Ignore issues reading error text */ }
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                console.log("API Data Received for MyStorehouse:", data); // Log to verify structure
                // **Important:** Ensure data has 'storehouseId' property
                if (!data || typeof data.storehouseId === 'undefined') {
                     console.error("API Response is missing 'storehouseId':", data);
                     throw new Error("Received invalid storehouse data from the server (missing ID).");
                }
                setStorehouseData(data);

            } catch (err) {
                console.error("Failed to fetch storehouse data:", err);
                setError(err.message || 'Failed to fetch data. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchStorehouseData();
    }, []); // Removed API_URL dependency as it's constant here

    const handleViewSections = () => {
        // Check the actual property name from the console log above
        if (storehouseData && storehouseData.storehouseId && storehouseData.storehouseId > 0) {
            const id = storehouseData.storehouseId;
            console.log("MyStorehouse - Navigating to Sections with ID:", id);
            // **Ensure this path matches your actual Sections route**
            navigate(`/app/sections?storehouseId=${id}`);
        } else {
            const errorMsg = "Cannot navigate to sections: Storehouse ID is not available or invalid.";
            console.error(errorMsg, "Current Data:", storehouseData);
            setError(errorMsg);
        }
    };

    // --- NEW --- Handler for viewing workers
    const handleViewWorkers = () => {
        // Check the actual property name from the console log above
        if (storehouseData && storehouseData.storehouseId && storehouseData.storehouseId > 0) {
            const id = storehouseData.storehouseId;
            console.log("MyStorehouse - Navigating to Workers with ID:", id);
            // **Ensure this path matches your actual StorehouseWorkers route**
            navigate(`/app/storehouseWorkers?storehouseId=${id}`);
        } else {
             const errorMsg = "Cannot navigate to workers: Storehouse ID is not available or invalid.";
             console.error(errorMsg, "Current Data:", storehouseData);
             setError(errorMsg);
        }
    };
    // --- END NEW ---

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="text-center py-5">
                    <Spinner animation="border" role="status" variant="primary">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                    <p className="mt-2">Loading storehouse information...</p>
                </div>
            );
        }

        // Display error prominently if it occurs, even if data exists from previous load
        if (error) {
            return (
                <Alert variant="danger" className="d-flex align-items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-exclamation-triangle-fill flex-shrink-0 me-2" viewBox="0 0 16 16" role="img" aria-label="Warning:">
                        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
                    </svg>
                    <div>
                        <strong>Error:</strong> {error}
                    </div>
                </Alert>
            );
        }

        if (storehouseData) {
            // Check if storehouseId is valid before enabling buttons
            const isStorehouseIdValid = storehouseData.storehouseId && storehouseData.storehouseId > 0;

            return (
                <Card className="shadow-sm">
                    <Card.Header as="h5" className="bg-primary text-white d-flex align-items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-house-gear-fill me-2" viewBox="0 0 16 16">
                           {/* Icon path */}
                           <path d="M7.293 1.5a1 1 0 0 1 1.414 0L11 3.793V2.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v3.293l2.354 2.353a.5.5 0 0 1-.708.708L8 5.207 1.354 11.854a.5.5 0 1 1-.708-.708z"/>
                           <path d="M11.07 9.047a1.5 1.5 0 0 0-1.742.26l-.02.021a1.5 1.5 0 0 0-.26 1.742 1.5 1.5 0 0 0 1.742-.26l.02-.022a1.5 1.5 0 0 0 .26-1.742m-2.48 4.31a1.5 1.5 0 0 0-1.742-.26l-.02.022a1.5 1.5 0 0 0-.26 1.741 1.5 1.5 0 0 0 1.742.26l.02-.021a1.5 1.5 0 0 0 .26-1.741m4.256 a1.5 1.5 0 0 0-1.742-.26l-.02.022a1.5 1.5 0 0 0-.26 1.741 1.5 1.5 0 0 0 1.742.26l.02-.021a1.5 1.5 0 0 0 .26-1.741m-1.55-5.487a.5.5 0 0 0-.488.6c.051.138.103.28.157.425l-1.377.612a.5.5 0 1 0 .433.918l1.742-.774a2.5 2.5 0 1 0 .012-1.81.5.5 0 0 0-.554-.03zm-4.59.218a2.5 2.5 0 1 0 2.5 0 2.5 2.5 0 0 0-2.5 0m.143.996a1.5 1.5 0 1 1 .001-3.001 1.5 1.5 0 0 1-.001 3.001"/>
                           <path d="M12.5 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7m.5-5v1h1a.5.5 0 0 1 0 1h-1v1a.5.5 0 1 1-1 0v-1h-1a.5.5 0 1 1 0-1h1v-1a.5.5 0 0 1 1 0"/>
                        </svg>
                        Storehouse Details
                    </Card.Header>
                    <Card.Body>
                        <div className="mb-3 row">
                            <strong className="col-sm-4 col-form-label">Name:</strong>
                            <div className="col-sm-8">
                                {/* Ensure 'name' property exists */}
                                <p className="form-control-plaintext">{storehouseData.storehouseName || storehouseData.name || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="mb-3 row">
                            <strong className="col-sm-4 col-form-label">Address / Location:</strong>
                            <div className="col-sm-8">
                                {/* Ensure 'address' property exists */}
                                <p className="form-control-plaintext">{storehouseData.address || 'N/A'}</p>
                            </div>
                        </div>
                        {/* Add other details as needed */}
                        {/* <div className="mb-3 row">
                             <strong className="col-sm-4 col-form-label">Storehouse ID:</strong>
                             <div className="col-sm-8">
                                <p className="form-control-plaintext">{storehouseData.storehouseId || 'N/A'}</p>
                            </div>
                         </div> */}

                        {/* Action Buttons Area */}
                        <div className="mt-4 d-flex justify-content-end gap-2"> {/* Use gap for spacing */}
                            <Button
                                variant="info"
                                onClick={handleViewSections}
                                disabled={!isStorehouseIdValid}
                                title={!isStorehouseIdValid ? "Storehouse ID not available" : "View sections for this storehouse"}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-grid-3x3-gap-fill me-1" viewBox="0 0 16 16">
                                  <path d="M1 2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1zM1 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1zM1 12a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z"/>
                                </svg>
                                View Sections
                            </Button>

                            {/* --- NEW BUTTON --- */}
                            <Button
                                variant="secondary" // Or another appropriate variant
                                onClick={handleViewWorkers}
                                disabled={!isStorehouseIdValid}
                                title={!isStorehouseIdValid ? "Storehouse ID not available" : "See workers assigned to this storehouse"}
                            >
                               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-people-fill me-1" viewBox="0 0 16 16">
                                 <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5.784 6A2.24 2.24 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.3 6.3 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"/>
                               </svg>
                                See All Workers
                            </Button>
                            {/* --- END NEW BUTTON --- */}
                        </div>
                    </Card.Body>
                    <Card.Footer className="text-muted">
                        Storehouse assigned via your user profile.
                    </Card.Footer>
                </Card>
            );
        }

        // Fallback if no error, not loading, but data is null/undefined
        return <Alert variant="warning">Could not load storehouse data.</Alert>;
    };

    return (
        <div className="container mt-4">
            <h1 className="mb-4">My Storehouse Information</h1>
            {renderContent()}
        </div>
    );
}

export default MyStorehouse;