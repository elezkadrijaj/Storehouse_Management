// src/components/LeaveRequestTable.js

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { Trash } from 'react-bootstrap-icons';

// Konstante për të marrë tokenin nga sessionStorage
const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
};

// URL-ja e endpoint-it, e ndërtuar duke përdorur variablin e mjedisit
const API_ENDPOINT = `https://localhost:7204/api/LeaveRequest`;

// Komponenti NUK merr më 'apiBaseUrl' si prop
const LeaveRequestTable = () => {
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
                // Tani përdorim konstanten API_ENDPOINT
                const response = await axios.get(API_ENDPOINT, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setRequests(response.data);
            } catch (err) {
                console.error("Failed to fetch leave requests:", err);
                let errorMessage = 'An unexpected error occurred.';
                if (err.response) {
                    errorMessage = `Server error: ${err.response.status} - ${err.response.statusText}`;
                    if (err.response.data && typeof err.response.data === 'string') {
                        errorMessage = err.response.data;
                    }
                } else if (err.request) {
                    errorMessage = 'No response from server. Please check your network connection.';
                } else {
                    errorMessage = err.message;
                }
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaveRequests();
    }, []); // Vargu i varësive është bosh, kështu që useEffect ekzekutohet vetëm një herë

    const handleDelete = async (requestId) => {
        if (!window.confirm("Are you sure you want to delete this leave request?")) {
            return;
        }

        const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
        try {
            // Përdorim API_ENDPOINT për të ndërtuar URL-në e fshirjes
            await axios.delete(`${API_ENDPOINT}/${requestId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setRequests(prevRequests => prevRequests.filter(req => req.leaveRequestId !== requestId));
        } catch (err) {
            console.error(`Failed to delete request ${requestId}:`, err);
            const errorMsg = err.response?.data || "Failed to delete the request. Please try again.";
            alert(errorMsg);
        }
    };

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