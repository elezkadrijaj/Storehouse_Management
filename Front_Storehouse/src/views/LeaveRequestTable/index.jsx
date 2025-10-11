// src/components/LeaveRequestTable.js

import React, { useState, useEffect } from 'react';
import { Table, Button, Spinner, Alert } from 'react-bootstrap';
import { Trash } from 'react-bootstrap-icons';
import apiClient from '../../appService'; // REFACTORED: Import the centralized apiClient

// Note: The direct import for 'axios' and the API_ENDPOINT constant have been removed.

// Konstante për të marrë tokenin nga sessionStorage
const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
};

const LeaveRequestTable = () => {
    // --- All state hooks remain the same ---
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLeaveRequests = async () => {
            setLoading(true);
            setError(null);

            const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
            if (!token) {
                setError("Authentication token not found. Please log in again.");
                setLoading(false);
                return;
            }

            try {
                // REFACTORED: Use apiClient with a relative URL
                const response = await apiClient.get('/LeaveRequest', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setRequests(response.data);
            } catch (err) {
                console.error("Failed to fetch leave requests:", err);
                // Error handling logic remains the same, as apiClient has the same structure
                let errorMessage = 'An unexpected error occurred.';
                if (err.response) {
                    errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
                } else if (err.request) {
                    errorMessage = 'No response from server.';
                } else {
                    errorMessage = err.message;
                }
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaveRequests();
    }, []); // Dependency array is empty, so it runs once on mount

    const handleDelete = async (requestId) => {
        if (!window.confirm("Are you sure you want to delete this leave request?")) {
            return;
        }

        const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
        try {
            // REFACTORED: Use apiClient with a relative URL
            await apiClient.delete(`/LeaveRequest/${requestId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setRequests(prevRequests => prevRequests.filter(req => req.leaveRequestId !== requestId));
        } catch (err) {
            console.error(`Failed to delete request ${requestId}:`, err);
            const errorMsg = err.response?.data?.message || "Failed to delete the request. Please try again.";
            alert(errorMsg);
        }
    };

    // --- The entire return JSX remains exactly the same ---
    if (loading) {
        return (
            <div className="text-center my-5">
                <Spinner animation="border" role="status" />
                <p>Loading leave requests...</p>
            </div>
        );
    }

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }

    if (requests.length === 0) {
        return <Alert variant="info">No leave requests found for your company.</Alert>;
    }

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString();

    return (
        <Table striped bordered hover responsive>
            <thead>
                <tr>
                    <th>Employee</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Reason</th>
                    <th>Assigned Manager</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {requests.map(request => (
                    <tr key={request.leaveRequestId}>
                        <td>{request.applicationUser?.userName || 'N/A'}</td>
                        <td>{formatDate(request.startDate)}</td>
                        <td>{formatDate(request.endDate)}</td>
                        <td>{request.description}</td>
                        <td>{request.applicationUserMenager?.userName || 'N/A'}</td>
                        <td>
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDelete(request.leaveRequestId)}
                            >
                                <Trash /> Delete
                            </Button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </Table>
    );
};

export default LeaveRequestTable;