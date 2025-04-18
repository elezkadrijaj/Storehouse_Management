import React, { useState, useEffect } from 'react';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils';
import { useSearchParams } from 'react-router-dom';
import { Table, Alert, Spinner, Badge } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken', // Included for consistency, though not used directly here
    USER_ID: 'userId',
    USER_ROLE: 'userRole', // Included for consistency, though not used directly here
    USER_NAME: 'userName', // Included for consistency, though not used directly here
};


function StorehouseWorkers() {
    const [workers, setWorkers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [storehouseName, setStorehouseName] = useState(''); 
    const [searchParams] = useSearchParams();
    const storehouseId = searchParams.get('storehouseId');

    const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

    useEffect(() => {

        setIsLoading(true);
        setError(null);
        setWorkers([]);
        setStorehouseName('');

        if (!token) {
            setError("Authentication Error: No token found. Please log in.");
            setIsLoading(false);
            return;
        }

        const parsedStorehouseId = parseInt(storehouseId, 10);
        if (!storehouseId || isNaN(parsedStorehouseId) || parsedStorehouseId <= 0) {
            setError("Invalid or missing Storehouse ID in the URL.");
            setIsLoading(false);
            return;
        }

        const fetchStorehouseDataAndWorkers = async (id) => {
            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            };

            const storehouseDetailsUrl = `https://localhost:7204/api/Storehouses/${id}`; 
            const workersUrl = `https://localhost:7204/api/Storehouses/storehouses/${id}/workers`; 

            console.log(`Fetching details from: ${storehouseDetailsUrl}`);
            console.log(`Fetching workers from: ${workersUrl}`);

            try {
                // Fetch both concurrently
                const [storehouseResponse, workersResponse] = await Promise.all([
                    axios.get(storehouseDetailsUrl, config),
                    axios.get(workersUrl, config)
                ]);

                setStorehouseName(storehouseResponse.data.storehouseName || `ID: ${id}`);
                setWorkers(workersResponse.data);

            } catch (err) {
                console.error(`Error fetching data for Storehouse ID ${id}:`, err);
                let errorMessage = `An unexpected error occurred while fetching data for Storehouse ID ${id}.`;
                if (err.response) {

                    if (err.response.config?.url?.includes('/workers') && err.response.status === 404) {
 
                        errorMessage = err.response.data?.message || `No workers found for Storehouse ID ${id}.`;
                         setWorkers([]);

                         setStorehouseName(prevName => prevName || `ID: ${id}`); 
                    } else if (err.response.config?.url?.includes('/Storehouses/') && !err.response.config.url.includes('/workers') && err.response.status === 404) {
                         errorMessage = `Storehouse with ID ${id} not found.`;
                         setError(errorMessage);
                         setIsLoading(false);
                         return; 
                    }

                    else if (err.response.status === 401 || err.response.status === 403) {
                        errorMessage = "Authorization failed. Please check your permissions or log in again.";
                    } else if (err.response.status === 400) {
                        errorMessage = err.response.data?.message || `Invalid request for Storehouse ID ${id}.`;
                    } else if (err.response.data) {
                        errorMessage = err.response.data.message || err.response.data.title || JSON.stringify(err.response.data);
                    } else {
                        errorMessage = `Error: ${err.response.status} ${err.response.statusText || 'Request Failed'}`;
                    }
                } else if (err.request) {
                    errorMessage = "Network Error: Could not connect to the API server.";
                } else {
                    errorMessage = err.message;
                }
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStorehouseDataAndWorkers(parsedStorehouseId);

    }, [storehouseId, token]);

    return (
        <div className="container mt-4">
 
            <h1>
                Workers for Storehouse: {isLoading ? 'Loading...' : (storehouseName )}
            </h1>

            {isLoading && (
                <div className="text-center">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                    <p>Loading data...</p>
                </div>
            )}

            {!isLoading && error && (
                <Alert variant="danger">{error}</Alert>
            )}
            {!isLoading && !error && (
                <>
                    {workers.length > 0 ? (
                        <Table striped bordered hover responsive size="sm">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th>Company Name</th>
                                    <th>Business Number</th>
                                    <th>Storehouse Name</th>
                                    <th>Role</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workers.map((worker, index) => (
                                    <tr key={worker.id}>
                                        <td>{index + 1}</td>
                                        <td>{worker.username}</td>
                                        <td>{worker.email}</td>
                                        <td>
                                            <Badge bg={worker.emailConfirmed ? 'success' : 'warning'}>
                                                {worker.emailConfirmed ? 'Confirmed' : 'Pending'}
                                            </Badge>
                                        </td>
                                        <td>{worker.companyName || 'N/A'}</td>
                                        <td>{worker.companyBusinessNumber || 'N/A'}</td>
                                        <td>{worker.storeHouseName || 'N/A'}</td>
                                        <td>{worker.role || 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    ) : (
                         <Alert variant="info">No workers found assigned to this storehouse.</Alert>
                    )}
                </>
            )}
        </div>
    );
}

export default StorehouseWorkers;