// src/views/AllRoles.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    Table,
    Spinner,
    Alert,
    Container
} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import apiClient from '../../appService';

// const API_ACCOUNT_BASE_URL = 'https://localhost:7204/api/Account';
const SESSION_STORAGE_KEYS = { TOKEN: 'authToken' };

function AllRoles() {
    const [roles, setRoles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

    const fetchAllRoles = useCallback(async () => {
        if (!token) {
            setError("Authentication token not found. Please log in.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.get(`/Account/assignable-roles`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (Array.isArray(response.data)) {
                if (response.data.length > 0 && typeof response.data[0] === 'string') {
                    setRoles(response.data.map(name => ({ id: name, name: name })));
                } else {
                    setRoles(response.data);
                }
            } else {
                setRoles([]);
            }
        } catch (err) {
            console.error("Error fetching roles:", err.response || err);
            let errorMessage = "An unexpected error occurred while fetching roles.";
            if (err.response) {
                errorMessage = err.response.data?.message || `Error: ${err.response.status}`;
            } else if (err.request) {
                errorMessage = "Network Error. Could not connect to the server.";
            } else {
                errorMessage = err.message;
            }
            setError(errorMessage);
            setRoles([]);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchAllRoles();
    }, [fetchAllRoles]);

    if (isLoading && roles.length === 0 && !error) {
        return (
            <Container className="mt-4 text-center">
                <Spinner animation="border" />
                <p>Loading roles...</p>
            </Container>
        );
    }

    return (
        <Container className="mt-4">
            {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1>All System Roles</h1>
            </div>

            {isLoading && roles.length > 0 && <div className="text-center my-2"><Spinner animation="grow" size="sm" /> Refreshing list...</div>}

            {roles.length === 0 && !isLoading && !error && (
                <Alert variant="info">No roles found in the system.</Alert>
            )}

            {roles.length > 0 && (
                <Table striped bordered hover responsive size="sm">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Role Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        {roles.map((role, index) => (
                            <tr key={typeof role === 'object' ? role.id : role || index}>
                                <td>{index + 1}</td>
                                <td>{typeof role === 'object' ? role.name : role}</td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
        </Container>
    );
}

export default AllRoles;