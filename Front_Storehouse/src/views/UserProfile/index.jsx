import React, { useState, useEffect } from 'react';
import { Container, Card, ListGroup, Badge, Spinner, Alert, Row, Col, Button, Modal } from 'react-bootstrap';
import LeaveRequest from '../LeaveRequest/index';
import apiClient from '../../appService';

// REFACTORED: TOKEN is no longer stored here.
const SESSION_STORAGE_KEYS = {
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

const UserProfile = () => {
    // All state hooks remain the same.
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
            // We still need the userId for the API endpoint URL.
            const userId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);

            // UPDATED: New auth check. We only need userId now, not the token.
            if (!userId) {
                setError('User session not found. Please log in again.');
                setLoading(false);
                return;
            }

            try {
                // REFACTORED: Simplified API call.
                // No headers needed; the browser sends the auth cookie automatically.
                const response = await apiClient.get(`/Account/me/${userId}`);
                setUserProfile(response.data);
            } catch (err) {
                console.error('Failed to fetch user profile:', err);
                setError(err.response?.data?.message || 'An unexpected error occurred.');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const fetchWorkContractDetails = async () => {
        setContractLoading(true);
        setContractError(null);
        const userId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);

        if (!userId) {
            setContractError('User session not found.');
            setContractLoading(false);
            return;
        }

        try {
            // REFACTORED: Simplified API call.
            const response = await apiClient.get(`/WorkContract/user/${userId}`);
            setContractData(response.data);
        } catch (err) {
            console.error("Error fetching work contract:", err);
            setContractError(err.response?.data?.message || `Error: ${err.response?.status}`);
        } finally {
            setContractLoading(false);
        }
    };

    // Other handlers remain the same
    const handleCloseContractModal = () => setShowContractModal(false);
    const handleShowContractModal = () => {
        setShowContractModal(true);
        if (!contractData && !contractError) fetchWorkContractDetails();
    };
    const handleShowLeaveRequestModal = () => setShowLeaveRequestModal(true);
    const handleCloseLeaveRequestModal = () => setShowLeaveRequestModal(false);

    // The entire return JSX remains exactly the same.
    if (loading) return <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}><Spinner animation="border" variant="primary" /></Container>;
    if (error) return <Container className="mt-4"><Alert variant="danger"><Alert.Heading>Error Loading Profile</Alert.Heading><p>{error}</p></Alert></Container>;
    if (!userProfile) return <Container className="mt-4"><Alert variant="warning">Could not load user profile data.</Alert></Container>;

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
                                <ListGroup.Item className="d-flex justify-content-between align-items-start"><div><strong>Email Confirmed:</strong></div><Badge bg={userProfile.emailConfirmed ? "success" : "warning"}>{userProfile.emailConfirmed ? 'Yes' : 'No'}</Badge></ListGroup.Item>
                                <ListGroup.Item><strong>User ID:</strong> <code className='p-1 bg-light rounded'>{userProfile.id}</code></ListGroup.Item>
                            </ListGroup>
                            <Card.Title as="h5">Roles</Card.Title>
                            <ListGroup variant="flush" className="mb-3"><ListGroup.Item>{userProfile.roles?.length > 0 ? userProfile.roles.map(role => <Badge key={role} pill bg="info" className="me-2 p-2">{role}</Badge>) : <span className="text-muted">No roles assigned.</span>}</ListGroup.Item></ListGroup>
                            {(userProfile.companiesId || userProfile.companyName) && (<><Card.Title as="h5">Company Information</Card.Title><ListGroup variant="flush" className="mb-3">{userProfile.companyName && <ListGroup.Item><strong>Company Name:</strong> {userProfile.companyName}</ListGroup.Item>}{userProfile.companiesId && <ListGroup.Item><strong>Company ID:</strong> {userProfile.companiesId}</ListGroup.Item>}</ListGroup></>)}
                            {(userProfile.storehouseId || userProfile.storehouseName) && (<><Card.Title as="h5">Storehouse Information</Card.Title><ListGroup variant="flush" className="mb-3">{userProfile.storehouseName && <ListGroup.Item><strong>Storehouse Name:</strong> {userProfile.storehouseName}</ListGroup.Item>}{userProfile.storehouseId && <ListGroup.Item><strong>Storehouse ID:</strong> {userProfile.storehouseId}</ListGroup.Item>}</ListGroup></>)}
                            <hr /><div className="d-grid gap-2"><Button variant="info" onClick={handleShowContractModal}>View Work Contract</Button><Button variant="success" onClick={handleShowLeaveRequestModal}>Request Leave</Button></div>
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
            {userProfile && <LeaveRequest show={showLeaveRequestModal} onHide={handleCloseLeaveRequestModal} userId={userProfile.id} />}
        </Container>
    );
};

export default UserProfile;