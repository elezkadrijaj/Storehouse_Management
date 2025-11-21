// src/components/LeaveRequestTable.js

import React, { useState, useEffect } from 'react';
import { Table, Button, Spinner, Alert } from 'react-bootstrap';
import { Trash } from 'react-bootstrap-icons';
import apiClient from '../../appService'; // Using the centralized apiClient

// NOTE: The SESSION_STORAGE_KEYS for TOKEN has been removed as it is no longer used.
const SESSION_STORAGE_KEYS = {
    USER_ROLE: 'userRole', // We can use this to check if a user is logged in.
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

            // --- START OF FIX ---
            // UPDATED: We now check for 'userRole' to determine if a session is active.
            const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
            if (!userRole) {
                setError("You are not logged in. Please log in to view leave requests.");
                setLoading(false);
                return;
            }

            try {
                // REFACTORED: Simplified API call.
                // No headers are needed; the browser sends the auth cookie automatically.
                const response = await apiClient.get('/LeaveRequest');
                setRequests(response.data);
            } catch (err) {
                console.error("Failed to fetch leave requests:", err);
                const errorMessage = err.response?.data?.message || 'Failed to fetch leave requests.';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
            // --- END OF FIX ---
        };

        fetchLeaveRequests();
    }, []); // Empty dependency array, so it runs once on mount

    const handleDelete = async (requestId) => {
        if (!window.confirm("Are you sure you want to delete this leave request?")) {
            return;
        }

        try {
            // REFACTORED: Simplified API call.
            // No headers are needed for the DELETE request.
            await apiClient.delete(`/LeaveRequest/${requestId}`);
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