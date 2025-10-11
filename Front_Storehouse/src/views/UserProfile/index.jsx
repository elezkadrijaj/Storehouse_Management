import React, { useState, useEffect } from 'react';

// Import React Bootstrap components
import { Container, Card, ListGroup, Badge, Spinner, Alert, Row, Col, Button, Modal } from 'react-bootstrap';

import LeaveRequest from '../LeaveRequest/index';
import apiClient from '../../appService'; // REFACTORED: Import the centralized apiClient

// Note: The direct import for 'axios' and API_..._URL constants have been removed.

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

const UserProfile = () => {
    // --- All state hooks remain the same ---
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showContractModal, setShowContractModal] = useState(false);
    const [contractData, setContractData] = useState(null);
    const [contractLoading, setContractLoading] = useState(false);
    const [contractError, setContractError] = useState(null);
    const [showLeaveRequestModal, setShowLeaveRequestModal] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            setError(null);
            const userId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);
            const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

            if (!userId || !token) {
                setError('User ID or authentication token not found. Please log in again.');
                setLoading(false);
                return;
            }
            try {
                // REFACTORED: Use apiClient with a relative URL
                const response = await apiClient.get(`/Account/me/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                setUserProfile(response.data);
            } catch (err) {
                console.error('Failed to fetch user profile:', err);
                const errorMessage = err.response?.data?.message || err.message || 'An unexpected error occurred.';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const fetchWorkContractDetails = async () => {
        setContractLoading(true);
        setContractError(null);
        setContractData(null);

        const userId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);
        const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

        if (!userId || !token) {
            setContractError('User ID or token not found.');
            setContractLoading(false);
            return;
        }
        try {
            // REFACTORED: Use apiClient with a relative URL
            const response = await apiClient.get(`/WorkContract/user/${userId}`, {
                 headers: { 'Authorization': `Bearer ${token}` }
            });
            setContractData(response.data);
        } catch (err) {
            console.error("Error fetching work contract:", err);
            const errorMessage = err.response?.data?.message || `Error: ${err.response?.status}`;
            setContractError(errorMessage);
        } finally {
            setContractLoading(false);
        }
    };

    // --- All other handler functions and JSX logic remain the same ---
    const handleCloseContractModal = () => setShowContractModal(false);
    const handleShowContractModal = () => {
        setShowContractModal(true);
        if (!contractData && !contractError) {
            fetchWorkContractDetails();
        }
    };
    const handleShowLeaveRequestModal = () => setShowLeaveRequestModal(true);
    const handleCloseLeaveRequestModal = () => setShowLeaveRequestModal(false);

    if (loading) {
        return <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}><Spinner animation="border" variant="primary" /></Container>;
    }
    if (error) {
        return <Container className="mt-4"><Alert variant="danger"><Alert.Heading>Error Loading Profile</Alert.Heading><p>{error}</p></Alert></Container>;
    }
    if (!userProfile) {
        return <Container className="mt-4"><Alert variant="warning">Could not load user profile data.</Alert></Container>;
    }

    return (
        <Container className="mt-4 mb-4">
            <Row className="justify-content-center">
                <Col md={10} lg={8}>
                    <Card border="primary">
                        <Card.Header as="h4" className="text-center bg-primary text-white">My Profile</Card.Header>
                        <Card.Body>
                            <Card.Title as="h5">Account Information</Card.Title>
                            <ListGroup variant="flush" className="mb-3">
                                <ListGroup.Item><strong>Username:</strong> {userProfile.username}</ListGroup.Item>
                                <ListGroup.Item><strong>Email:</strong> {userProfile.email}</ListGroup.Item>
                                <ListGroup.Item className="d-flex justify-content-between align-items-start">
                                    <div><strong>Email Confirmed:</strong></div>
                                    <Badge bg={userProfile.emailConfirmed ? "success" : "warning"}>{userProfile.emailConfirmed ? 'Yes' : 'No'}</Badge>
                                </ListGroup.Item>
                                <ListGroup.Item><strong>User ID:</strong> <code className='p-1 bg-light rounded'>{userProfile.id}</code></ListGroup.Item>
                            </ListGroup>

                            <Card.Title as="h5">Roles</Card.Title>
                            <ListGroup variant="flush" className="mb-3">
                                <ListGroup.Item>
                                    {userProfile.roles?.length > 0 ? userProfile.roles.map(role => <Badge key={role} pill bg="info" className="me-2 p-2">{role}</Badge>) : <span className="text-muted">No roles assigned.</span>}
                                </ListGroup.Item>
                            </ListGroup>

                            {(userProfile.companiesId || userProfile.companyName) && (
                                <>
                                    <Card.Title as="h5">Company Information</Card.Title>
                                    <ListGroup variant="flush" className="mb-3">
                                        {userProfile.companyName && <ListGroup.Item><strong>Company Name:</strong> {userProfile.companyName}</ListGroup.Item>}
                                        {userProfile.companiesId && <ListGroup.Item><strong>Company ID:</strong> {userProfile.companiesId}</ListGroup.Item>}
                                    </ListGroup>
                                </>
                            )}
                             {(userProfile.storehouseId || userProfile.storehouseName) && (
                                <>
                                    <Card.Title as="h5">Storehouse Information</Card.Title>
                                    <ListGroup variant="flush"  className="mb-3">
                                        {userProfile.storehouseName && <ListGroup.Item><strong>Storehouse Name:</strong> {userProfile.storehouseName}</ListGroup.Item>}
                                        {userProfile.storehouseId && <ListGroup.Item><strong>Storehouse ID:</strong> {userProfile.storehouseId}</ListGroup.Item>}
                                    </ListGroup>
                                </>
                            )}
                            <hr />
                            <div className="d-grid gap-2">
                                <Button variant="info" onClick={handleShowContractModal}>View Work Contract</Button>
                                <Button variant="success" onClick={handleShowLeaveRequestModal}>Request Leave</Button>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Modal show={showContractModal} onHide={handleCloseContractModal} size="lg" centered>
                <Modal.Header closeButton><Modal.Title>Your Work Contract Details</Modal.Title></Modal.Header>
                <Modal.Body>
                    {contractLoading && <div className="text-center"><Spinner animation="border" variant="primary" /></div>}
                    {contractError && !contractLoading && <Alert variant="danger">{contractError}</Alert>}
                    {contractData && !contractLoading && !contractError && (
                        <dl className="row">
                            <dt className="col-sm-4">Contract ID:</dt><dd className="col-sm-8">{contractData.workContractId}</dd>
                            <dt className="col-sm-4">Start Date:</dt><dd className="col-sm-8">{contractData.startDate ? new Date(contractData.startDate).toLocaleDateString() : 'N/A'}</dd>
                            <dt className="col-sm-4">End Date:</dt><dd className="col-sm-8">{contractData.endDate ? new Date(contractData.endDate).toLocaleDateString() : 'N/A'}</dd>
                            <dt className="col-sm-4">Salary:</dt><dd className="col-sm-8">{contractData.salary?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || 'N/A'}</dd>
                            <dt className="col-sm-4">Document:</dt><dd className="col-sm-8">{contractData.contractFileUrl ? <a href={contractData.contractFileUrl} target="_blank" rel="noopener noreferrer">View</a> : 'N/A'}</dd>
                        </dl>
                    )}
                </Modal.Body>
                <Modal.Footer><Button variant="secondary" onClick={handleCloseContractModal}>Close</Button></Modal.Footer>
            </Modal>
            
            {userProfile && (
                 <LeaveRequest
                    show={showLeaveRequestModal}
                    onHide={handleCloseLeaveRequestModal}
                    userId={userProfile.id}
                    // REFACTORED: The apiBaseUrl prop has been removed.
                />
            )}
        </Container>
    );
};

export default UserProfile;