import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useNavigate } from 'react-router-dom';
import { Button, Spinner, Alert, Card } from 'react-bootstrap';
import apiClient from '../../appService'; // Import the centralized apiClient

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

function MyStorehouse() {
    const [storehouseData, setStorehouseData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);

    // The hardcoded API_URL constant has been removed.

    useEffect(() => {
        const fetchStorehouseData = async () => {
            setIsLoading(true);
            setError(null);

            const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

            if (!token) {
                setError('Authentication token not found. Please log in.');
                setIsLoading(false);
                return;
            }

            try {
                // REFACTORED: Replaced fetch with apiClient.get
                // apiClient handles the base URL and JSON parsing automatically.
                const response = await apiClient.get('/Storehouses/my-storehouse-info', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                // With axios, a non-2xx response automatically throws an error,
                // so we can directly use the data.
                setStorehouseData(response.data);

            } catch (err) {
                // REFACTORED: Updated error handling for axios's error structure.
                const errorMessage = err.response?.data?.message || err.response?.data?.title || err.message || 'Failed to fetch data. Please try again later.';
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStorehouseData();
    }, []);

    // --- No changes are needed below this line ---

    const handleViewSections = () => {
        if (storehouseData?.storehouseId > 0) {
            navigate(`/app/sections?storehouseId=${storehouseData.storehouseId}`);
        } else {
            setError("Cannot navigate: Storehouse ID is not available.");
        }
    };

    const handleViewWorkers = () => {
        if (storehouseData?.storehouseId > 0) {
            navigate(`/app/storehouseWorkers?storehouseId=${storehouseData.storehouseId}`);
        } else {
            setError("Cannot navigate: Storehouse ID is not available.");
        }
    };

    const handleViewMySchedule = () => {
        navigate('/app/schedule');
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2">Loading storehouse information...</p>
                </div>
            );
        }

        if (error) {
            return <Alert variant="danger">{error}</Alert>;
        }

        if (storehouseData) {
            const isStorehouseIdValid = storehouseData.storehouseId > 0;

            return (
                <Card className="shadow-sm">
                    <Card.Header as="h5" className="bg-primary text-white">Storehouse Details</Card.Header>
                    <Card.Body>
                        <div className="mb-3 row">
                            <strong className="col-sm-4 col-form-label">Name:</strong>
                            <div className="col-sm-8"><p className="form-control-plaintext">{storehouseData.name || 'N/A'}</p></div>
                        </div>
                        <div className="mb-3 row">
                            <strong className="col-sm-4 col-form-label">Address:</strong>
                            <div className="col-sm-8"><p className="form-control-plaintext">{storehouseData.address || 'N/A'}</p></div>
                        </div>
                        
                        <div className="mt-4 d-flex justify-content-end gap-2 flex-wrap">
                            <Button variant="info" onClick={handleViewSections} disabled={!isStorehouseIdValid}>
                                View Sections
                            </Button>
                            {userRole && userRole !== 'Worker' && (
                                <Button variant="secondary" onClick={handleViewWorkers} disabled={!isStorehouseIdValid}>
                                   See All Workers
                                </Button>
                            )}

                            <Button variant="dark" onClick={handleViewMySchedule}>
                                My Schedule
                            </Button>
                        </div>
                    </Card.Body>
                </Card>
            );
        }

        return <Alert variant="warning">Could not load storehouse data. This might happen if no storehouse is assigned to you.</Alert>;
    };

    return (
        <div className="container mt-4">
            <h1 className="mb-4">My Storehouse Information</h1>
            {renderContent()}
        </div>
    );
}

export default MyStorehouse;