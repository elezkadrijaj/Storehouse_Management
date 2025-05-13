import React, { useState } from 'react';
import axios from 'axios';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';

// --- Define Keys for Session Storage (copied from UserProfile for token access) ---
const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    USER_ID: 'userId', // We get userId via prop now, but token is still from here
};

const LeaveRequestModal = ({ show, onHide, userId, apiBaseUrl }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [description, setDescription] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const resetForm = () => {
        setStartDate('');
        setEndDate('');
        setDescription('');
        setError(null);
        setSuccess(null);
    };

    const handleModalClose = () => {
        resetForm();
        onHide(); // Call the original onHide passed from parent
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        if (!startDate || !endDate || !description) {
            setError("All fields are required.");
            return;
        }
        if (new Date(endDate) < new Date(startDate)) {
            setError("End date cannot be before start date.");
            return;
        }

        setSubmitting(true);

        const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
        if (!token) {
            setError("Authentication token not found. Please log in again.");
            setSubmitting(false);
            return;
        }

        const leaveRequestDto = {
            userId: userId, // This comes from props now
            startDate: startDate,
            endDate: endDate,
            description: description
        };

        try {
            await axios.post(`${apiBaseUrl}`, leaveRequestDto, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            setSuccess('Leave request submitted successfully!');
            // Optionally close modal on success after a delay, or let user close it
            setTimeout(() => {
                handleModalClose();
            }, 2000);
        } catch (err) {
            console.error('Failed to submit leave request:', err);
            let errorMessage = 'An unexpected error occurred.';
            if (err.response) {
                // Try to get specific error messages from backend if available
                const data = err.response.data;
                if (data && typeof data === 'string') {
                    errorMessage = data;
                } else if (data && data.errors) { // ASP.NET Core validation errors
                    errorMessage = Object.values(data.errors).flat().join(' ');
                } else if (data && data.title) { // ASP.NET Core problem details
                    errorMessage = data.title;
                } else {
                    errorMessage = `Server error: ${err.response.status} - ${err.response.statusText}`;
                }
            } else if (err.request) {
                errorMessage = 'No response from server. Please check your network connection.';
            } else {
                errorMessage = err.message;
            }
            setError(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal show={show} onHide={handleModalClose} centered>
            <Modal.Header closeButton>
                <Modal.Title>Submit Leave Request</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                {success && <Alert variant="success">{success}</Alert>}

                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3" controlId="leaveStartDate">
                        <Form.Label>Start Date</Form.Label>
                        <Form.Control
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                            disabled={submitting}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="leaveEndDate">
                        <Form.Label>End Date</Form.Label>
                        <Form.Control
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                            disabled={submitting}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="leaveDescription">
                        <Form.Label>Description / Reason</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            disabled={submitting}
                        />
                    </Form.Group>

                    <div className="d-grid">
                        <Button variant="primary" type="submit" disabled={submitting}>
                            {submitting ? (
                                <>
                                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                                    Submitting...
                                </>
                            ) : (
                                'Submit Request'
                            )}
                        </Button>
                    </div>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleModalClose} disabled={submitting}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default LeaveRequestModal;