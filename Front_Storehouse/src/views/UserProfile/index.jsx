import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Import React Bootstrap components
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal'; // Keep for WorkContract Modal

// Import the new LeaveRequestModal
import LeaveRequest from '../LeaveRequest/index'; // Adjust path if necessary

// --- Define Keys for Session Storage (MUST MATCH Signin1.js) ---
const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

// API Base URL for WorkContract (can be moved to a config file)
const WORK_CONTRACT_API_BASE_URL = 'https://localhost:7204/api/WorkContract';
// API Base URL for LeaveRequest (can be moved to a config file)
const LEAVE_REQUEST_API_BASE_URL = 'https://localhost:7204/api/LeaveRequest';


const UserProfile = () => {
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for Work Contract Modal
    const [showContractModal, setShowContractModal] = useState(false);
    const [contractData, setContractData] = useState(null);
    const [contractLoading, setContractLoading] = useState(false);
    const [contractError, setContractError] = useState(null);

    // State for Leave Request Modal
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
            const apiUrl = `https://localhost:7204/api/Account/me/${userId}`;
            try {
                const response = await axios.get(apiUrl, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                setUserProfile(response.data);
            } catch (err) {
                console.error('Failed to fetch user profile:', err);
                let errorMessage = 'An unexpected error occurred fetching your profile.';
                if (err.response) {
                    errorMessage = err.response.data?.message || err.response.statusText || `HTTP error ${err.response.status}`;
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
        fetchProfile();
    }, []);

    // --- Work Contract Modal Functions ---
    const handleCloseContractModal = () => setShowContractModal(false);
    const fetchWorkContractDetails = async () => {
        // ... (your existing fetchWorkContractDetails function - no changes needed here)
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
        const apiUrl = `${WORK_CONTRACT_API_BASE_URL}/user/${userId}`;
        try {
            const response = await axios.get(apiUrl, {
                 headers: { 'Authorization': `Bearer ${token}` }
            });
            setContractData(response.data);
        } catch (err) {
            console.error("Error fetching work contract for modal:", err);
            let errorMessage = 'An unexpected error occurred.';
            if (err.response) {
                const serverMessage = err.response.data?.message || err.response.data;
                if (err.response.status === 404) {
                    errorMessage = serverMessage || `No work contract found for your user ID.`;
                } else {
                    errorMessage = `Server error: ${err.response.status} - ${serverMessage || err.response.statusText}`;
                }
            } else if (err.request) {
                errorMessage = 'Network Error: Could not connect to the server.';
            } else {
                errorMessage = `Error: ${err.message}`;
            }
            setContractError(errorMessage);
        } finally {
            setContractLoading(false);
        }
    };
    const handleShowContractModal = () => {
        setShowContractModal(true);
        if (!contractData || contractError) {
            fetchWorkContractDetails();
        }
    };

    // --- Leave Request Modal Functions ---
    const handleShowLeaveRequestModal = () => setShowLeaveRequestModal(true);
    const handleCloseLeaveRequestModal = () => setShowLeaveRequestModal(false);


    if (loading) { /* ... (no changes) ... */ 
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
                <Spinner animation="border" role="status" variant="primary">
                    <span className="visually-hidden">Loading Profile...</span>
                </Spinner>
            </Container>
        );
    }
    if (error) { /* ... (no changes) ... */ 
        return (
            <Container className="mt-4">
                <Alert variant="danger">
                    <Alert.Heading>Error Loading Profile</Alert.Heading>
                    <p>{error}</p>
                    <p className="mb-0">Please try logging out and logging back in.</p>
                </Alert>
            </Container>
        );
    }
    if (!userProfile) { /* ... (no changes) ... */ 
        return (
            <Container className="mt-4">
                <Alert variant="warning">Could not load user profile data.</Alert>
            </Container>
        );
    }

    return (
        <Container className="mt-4 mb-4">
            <Row className="justify-content-center">
                <Col md={10} lg={8}>
                    <Card border="primary">
                        <Card.Header as="h4" className="text-center bg-primary text-white">
                            My Profile
                        </Card.Header>
                        <Card.Body>
                            {/* ... (Existing Profile Sections: Account Info, Roles, Company, Storehouse) ... */}
                            <Card.Title as="h5">Account Information</Card.Title>
                            <ListGroup variant="flush" className="mb-3">
                                {/* ... userProfile details ... */}
                                <ListGroup.Item><strong>Username:</strong> {userProfile.username}</ListGroup.Item>
                                <ListGroup.Item><strong>Email:</strong> {userProfile.email}</ListGroup.Item>
                                <ListGroup.Item className="d-flex justify-content-between align-items-start">
                                    <div><strong>Email Confirmed:</strong></div>
                                    <Badge bg={userProfile.emailConfirmed ? "success" : "warning"}>
                                        {userProfile.emailConfirmed ? 'Yes' : 'No'}
                                    </Badge>
                                </ListGroup.Item>
                                <ListGroup.Item><strong>User ID:</strong> <code className='p-1 bg-light rounded'>{userProfile.id}</code></ListGroup.Item>
                            </ListGroup>

                            <Card.Title as="h5">Roles</Card.Title>
                            <ListGroup variant="flush" className="mb-3">
                                <ListGroup.Item>
                                    {userProfile.roles && userProfile.roles.length > 0 ? (
                                        userProfile.roles.map((role) => (
                                            <Badge key={role} pill bg="info" className="me-2 p-2">{role}</Badge>
                                        ))
                                    ) : (
                                        <span className="text-muted">No roles assigned.</span>
                                    )}
                                </ListGroup.Item>
                            </ListGroup>

                            {(userProfile.companiesId || userProfile.companyName || userProfile.companyBusinessNumber) && (
                                <>
                                    <Card.Title as="h5">Company Information</Card.Title>
                                    <ListGroup variant="flush" className="mb-3">
                                        {userProfile.companyName && ( <ListGroup.Item> <strong>Company Name:</strong> {userProfile.companyName} </ListGroup.Item> )}
                                        {userProfile.companiesId && ( <ListGroup.Item> <strong>Company ID:</strong> {userProfile.companiesId} </ListGroup.Item> )}
                                        {userProfile.companyBusinessNumber && ( <ListGroup.Item> <strong>Business Number:</strong> {userProfile.companyBusinessNumber} </ListGroup.Item> )}
                                    </ListGroup>
                                </>
                            )}
                             {(userProfile.storehouseId || userProfile.storehouseName) && (
                                <>
                                    <Card.Title as="h5">Storehouse Information</Card.Title>
                                    <ListGroup variant="flush"  className="mb-3">
                                        {userProfile.storehouseName && ( <ListGroup.Item> <strong>Storehouse Name:</strong> {userProfile.storehouseName} </ListGroup.Item> )}
                                        {userProfile.storehouseId && ( <ListGroup.Item> <strong>Storehouse ID:</strong> {userProfile.storehouseId} </ListGroup.Item> )}
                                    </ListGroup>
                                </>
                            )}

                            {/* Section for Action Buttons */}
                            <hr />
                            <div className="d-grid gap-2"> {/* Use d-grid for stacked buttons or d-flex for side-by-side */}
                                <Button variant="info" onClick={handleShowContractModal}>
                                    View Work Contract
                                </Button>
                                <Button variant="success" onClick={handleShowLeaveRequestModal}> {/* NEW BUTTON */}
                                    Request Leave
                                </Button>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* --- Work Contract Modal --- */}
            <Modal show={showContractModal} onHide={handleCloseContractModal} size="lg" centered>
                {/* ... (your existing Work Contract Modal JSX - no changes needed here) ... */}
                <Modal.Header closeButton><Modal.Title>Your Work Contract Details</Modal.Title></Modal.Header>
                <Modal.Body>
                    {contractLoading && <div className="text-center"><Spinner animation="border" variant="primary" /><p className="mt-2">Loading contract...</p></div>}
                    {contractError && !contractLoading && <Alert variant="danger"><Alert.Heading>Error</Alert.Heading><p>{contractError}</p></Alert>}
                    {contractData && !contractLoading && !contractError && (
                        <dl className="row">
                            <dt className="col-sm-4">Contract ID:</dt><dd className="col-sm-8">{contractData.workContractId}</dd>
                            <dt className="col-sm-4">User ID:</dt><dd className="col-sm-8">{contractData.userId}</dd>
                            <dt className="col-sm-4">Start Date:</dt><dd className="col-sm-8">{contractData.startDate ? new Date(contractData.startDate).toLocaleDateString() : <span className="text-muted">N/A</span>}</dd>
                            <dt className="col-sm-4">End Date:</dt><dd className="col-sm-8">{contractData.endDate ? new Date(contractData.endDate).toLocaleDateString() : <span className="text-muted">N/A</span>}</dd>
                            <dt className="col-sm-4">Salary:</dt><dd className="col-sm-8">{contractData.salary ? contractData.salary.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : <span className="text-muted">N/A</span>}</dd>
                            <dt className="col-sm-4">Contract Document:</dt>
                            <dd className="col-sm-8">
                                {contractData.contractFileUrl ? (
                                    <a href={contractData.contractFileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm">View/Download</a>
                                ) : (<span className="text-muted">No document</span>)}
                            </dd>
                        </dl>
                    )}
                </Modal.Body>
                <Modal.Footer><Button variant="secondary" onClick={handleCloseContractModal}>Close</Button></Modal.Footer>
            </Modal>

            {/* --- Leave Request Modal --- */}
            {userProfile && ( // Ensure userProfile is loaded before rendering modal that might need userId
                 <LeaveRequest
                    show={showLeaveRequestModal}
                    onHide={handleCloseLeaveRequestModal}
                    userId={userProfile.id} // Pass the current user's ID
                    apiBaseUrl={LEAVE_REQUEST_API_BASE_URL}
                />
            )}
        </Container>
    );
};

export default UserProfile;