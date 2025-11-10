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

// NOTE: TOKEN is no longer stored in sessionStorage.
// We can use USER_ROLE to check if a session is active.
const SESSION_STORAGE_KEYS = {
    USER_ROLE: 'userRole'
};

function AllRoles() {
    // --- All state hooks remain the same ---
    const [roles, setRoles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAllRoles = useCallback(async () => {
        // --- START OF FIX ---
        // UPDATED: The new authentication check. If there's no userRole, the user isn't logged in.
        const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
        if (!userRole) {
            setError("You are not logged in. Please log in to view roles.");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            // REFACTORED: Simplified API call.
            // No headers are needed; the browser sends the auth cookie automatically.
            const response = await apiClient.get('/Account/assignable-roles');

            if (Array.isArray(response.data)) {
                // Your existing logic to handle the response format is good.
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
            const errorMessage = err.response?.data?.message || "Failed to fetch roles.";
            setError(errorMessage);
            setRoles([]);
        } finally {
            setIsLoading(false);
        }
        // --- END OF FIX ---
    }, []); // The dependency array is now empty, which is correct.

    useEffect(() => {
        fetchAllRoles();
    }, [fetchAllRoles]);

    // --- The entire return JSX remains exactly the same ---
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