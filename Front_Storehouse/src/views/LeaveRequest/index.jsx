import React, { useState } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import apiClient from '../../appService'; // Using the centralized apiClient

// NOTE: The SESSION_STORAGE_KEYS for TOKEN has been removed as it is no longer used.

const LeaveRequestModal = ({ show, onHide, userId }) => {
    // --- All state hooks remain the same ---
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
        onHide();
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        // --- START OF FIX ---
        // Your existing validation logic is correct and remains the same.
        if (!startDate || !endDate || !description) {
            setError("All fields are required.");
            return;
        }
        if (new Date(endDate) < new Date(startDate)) {
            setError("End date cannot be before start date.");
            return;
        }

        setSubmitting(true);

        // REMOVED: The manual token retrieval and checks are no longer necessary.
        // const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
        // if (!token) { ... }

        const leaveRequestDto = {
            userId: userId,
            startDate: startDate,
            endDate: endDate,
            description: description
        };

        try {
            // REFACTORED: Simplified API call.
            // apiClient's default 'Content-Type' is application/json.
            // The browser automatically sends the HttpOnly auth cookie because apiClient
            // is configured with `withCredentials: true`. No extra headers are needed.
            await apiClient.post('/LeaveRequest', leaveRequestDto);

            setSuccess('Leave request submitted successfully!');
            setTimeout(() => {
                handleModalClose();
            }, 2000);
        } catch (err) {
            console.error('Failed to submit leave request:', err);
            // Error handling logic remains the same.
            let errorMessage = 'An unexpected error occurred.';
            if (err.response) {
                const data = err.response.data;
                if (data && typeof data === 'string') errorMessage = data;
                else if (data && data.errors) errorMessage = Object.values(data.errors).flat().join(' ');
                else if (data && data.title) errorMessage = data.title;
                else errorMessage = `Server error: ${err.response.status}`;
            } else if (err.request) {
                errorMessage = 'No response from server.';
            } else {
                errorMessage = err.message;
            }
            setError(errorMessage);
        } finally {
            setSubmitting(false);
        }
        // --- END OF FIX ---
    };

    // --- The entire return JSX remains exactly the same ---
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
                        <Form.Control type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required disabled={submitting} />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="leaveEndDate">
                        <Form.Label>End Date</Form.Label>
                        <Form.Control type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required disabled={submitting} />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="leaveDescription">
                        <Form.Label>Description / Reason</Form.Label>
                        <Form.Control as="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required disabled={submitting} />
                    </Form.Group>

                    <div className="d-grid">
                        <Button variant="primary" type="submit" disabled={submitting}>
                            {submitting ? (
                                <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Submitting...</>
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