import React, { useState, useEffect } from 'react';
// import cookieUtils from 'views/auth/cookieUtils'; // No longer needed for retrieving auth state here

// Import React Bootstrap components
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

// --- Define Keys for Session Storage (MUST MATCH Signin1.js) ---
const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken', // Included for consistency, though not used directly here
    USER_ID: 'userId',
    USER_ROLE: 'userRole', // Included for consistency, though not used directly here
    USER_NAME: 'userName', // Included for consistency, though not used directly here
};

const UserProfile = () => {
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            setError(null);

            // --- Retrieve User ID and Token from sessionStorage ---
            const userId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);
            const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
            // --- End Retrieval ---

            if (!userId || !token) {
                setError('User ID or authentication token not found in session storage. Please log in again.');
                setLoading(false);
                return;
            }

            // API Endpoint using the retrieved userId
            const apiUrl = `https://localhost:7204/api/Account/me/${userId}`;

            try {
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        // Use the token retrieved from sessionStorage
                        'Authorization': `Bearer ${token}`,
                    },
                });

                const data = await response.json();

                if (!response.ok) {
                    const errorMessage = data?.message || response.statusText || `HTTP error ${response.status}`;
                    console.error("API Error Response:", data);
                    throw new Error(errorMessage);
                }

                setUserProfile(data);

            } catch (err) {
                console.error('Failed to fetch user profile:', err);
                setError(err.message || 'An unexpected error occurred while fetching your profile.');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();

    }, []); // Runs once on mount

    // --- Render Logic (Remains the same) ---

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-4">
                <Alert variant="danger">
                    <Alert.Heading>Error Loading Profile</Alert.Heading>
                    <p>{error}</p>
                    {/* Optional: Add a suggestion to re-login */}
                    <p className="mb-0">Please try logging out and logging back in.</p>
                </Alert>
            </Container>
        );
    }

    if (!userProfile) {
        // This state might occur if the API returns OK but with empty data, or if an error was cleared somehow.
        return (
            <Container className="mt-4">
                <Alert variant="warning">Could not load user profile data.</Alert>
            </Container>
        );
    }

    // --- Display Profile Data using React Bootstrap (Remains the same) ---
    return (
        <Container className="mt-4 mb-4">
            <Row className="justify-content-center">
                <Col md={10} lg={8}> {/* Control the max width */}
                    <Card border="primary">
                        <Card.Header as="h4" className="text-center bg-primary text-white">
                            My Profile
                        </Card.Header>
                        <Card.Body>
                            {/* Section 1: Account Info */}
                            <Card.Title as="h5">Account Information</Card.Title>
                            <ListGroup variant="flush" className="mb-3">
                                <ListGroup.Item>
                                    <strong>Username:</strong> {userProfile.username}
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>Email:</strong> {userProfile.email}
                                </ListGroup.Item>
                                <ListGroup.Item className="d-flex justify-content-between align-items-start">
                                    <div><strong>Email Confirmed:</strong></div>
                                    <Badge bg={userProfile.emailConfirmed ? "success" : "warning"}>
                                        {userProfile.emailConfirmed ? 'Yes' : 'No'}
                                    </Badge>
                                </ListGroup.Item>
                                <ListGroup.Item>
                                    <strong>User ID:</strong> <code className='p-1 bg-light rounded'>{userProfile.id}</code>
                                </ListGroup.Item>
                            </ListGroup>

                            {/* Section 2: Roles */}
                            <Card.Title as="h5">Roles</Card.Title>
                            <ListGroup variant="flush" className="mb-3">
                                <ListGroup.Item>
                                    {userProfile.roles && userProfile.roles.length > 0 ? (
                                        userProfile.roles.map((role) => (
                                            <Badge key={role} pill bg="info" className="me-2 p-2">
                                                {role}
                                            </Badge>
                                        ))
                                    ) : (
                                        <span className="text-muted">No roles assigned.</span>
                                    )}
                                </ListGroup.Item>
                            </ListGroup>

                            {/* Section 3: Company Info (Conditional) */}
                            {(userProfile.companiesId || userProfile.companyName || userProfile.companyBusinessNumber) && (
                                <>
                                    <Card.Title as="h5">Company Information</Card.Title>
                                    <ListGroup variant="flush" className="mb-3">
                                        {userProfile.companyName && (
                                            <ListGroup.Item>
                                                <strong>Company Name:</strong> {userProfile.companyName}
                                            </ListGroup.Item>
                                        )}
                                        {userProfile.companiesId && (
                                            <ListGroup.Item>
                                                <strong>Company ID:</strong> {userProfile.companiesId}
                                            </ListGroup.Item>
                                        )}
                                        {userProfile.companyBusinessNumber && (
                                            <ListGroup.Item>
                                                <strong>Business Number:</strong> {userProfile.companyBusinessNumber}
                                            </ListGroup.Item>
                                        )}
                                    </ListGroup>
                                </>
                            )}

                            {/* Section 4: Storehouse Info (Conditional) */}
                            {(userProfile.storehouseId || userProfile.storehouseName) && (
                                <>
                                    <Card.Title as="h5">Storehouse Information</Card.Title>
                                    <ListGroup variant="flush"> {/* No mb-3 on the last one */}
                                        {userProfile.storehouseName && (
                                            <ListGroup.Item>
                                                <strong>Storehouse Name:</strong> {userProfile.storehouseName}
                                            </ListGroup.Item>
                                        )}
                                        {userProfile.storehouseId && (
                                            <ListGroup.Item>
                                                <strong>Storehouse ID:</strong> {userProfile.storehouseId}
                                            </ListGroup.Item>
                                        )}
                                    </ListGroup>
                                </>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default UserProfile;