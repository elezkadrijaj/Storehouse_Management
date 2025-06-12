import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useNavigate } from 'react-router-dom';
import { Button, Spinner, Alert, Card } from 'react-bootstrap';

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole', // Make sure this is being saved on login
    USER_NAME: 'userName',
};

function MyStorehouse() {
    const [storehouseData, setStorehouseData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    // --- FIX: Get the user's role from session storage ---
    const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);

    const API_URL = 'https://localhost:7204/api/Storehouses/my-storehouse-info';

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
                const response = await fetch(API_URL, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    let errorMessage = `Error: ${response.status}`;
                    try {
                        const errorBody = await response.json();
                        errorMessage = errorBody.message || errorBody.title || errorMessage;
                    } catch (e) { /* ignore */ }
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                setStorehouseData(data);

            } catch (err) {
                setError(err.message || 'Failed to fetch data. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchStorehouseData();
    }, []);

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