import React, { useState, useEffect } from 'react';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils';
import { Form, Button, Alert } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Card, Row, Col } from 'react-bootstrap';

function MyStorehouses() {
    const [storehouses, setStorehouses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newStorehouseName, setNewStorehouseName] = useState('');
    const [newLocation, setNewLocation] = useState('');
    const [newSize_m2, setNewSize_m2] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const fetchStorehouses = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = cookieUtils.getCookie('token');

            if (!token) {
                setError('No token found. Please log in.');
                setLoading(false);
                return;
            }

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            };

            const response = await axios.get('https://localhost:7204/api/Companies/my-storehouses', config);

            if (Array.isArray(response.data)) {
                setStorehouses(response.data);
            } else {
                console.error("API did not return an array:", response.data);
                setStorehouses([]);
                setError("Failed to load storehouses: API returned unexpected data.");
            }
            setLoading(false);
        } catch (err) {
            console.log("CATCH:", err);
            setError(err.response?.data || err.message || 'An unexpected error occurred.');
            setLoading(false);
            setStorehouses([]);
        }
    };

    useEffect(() => {
        fetchStorehouses();
    }, []);

    const handleCreateStorehouse = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');
        try {
            const token = cookieUtils.getCookie('token');

            if (!token) {
                setErrorMessage('No token found. Please log in.');
                return;
            }

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            };

            const newStorehouse = {
                storehouseName: newStorehouseName,
                location: newLocation,
                size_m2: parseInt(newSize_m2, 10),
                companiesId: localStorage.getItem("companyID") //It will add new item on local storage
            };

            const response = await axios.post('https://localhost:7204/api/Storehouses', newStorehouse, config);
            setSuccessMessage('Storehouse created successfully!');
            setNewStorehouseName('');
            setNewLocation('');
            setNewSize_m2('');
            fetchStorehouses();
        } catch (err) {
            console.log("Error:", err.response) //Show the errors
            setError(err.response?.data || err.message || 'An unexpected error occurred.');
        }
    };

    if (loading) {
        return <div>Loading storehouses...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div className="container">
            <h2>My Storehouses</h2>

            {successMessage && <Alert variant="success">{successMessage}</Alert>}
            {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

            <Row xs={1} md={2} lg={3} className="g-4">
                {storehouses.map((storehouse) => (
                    <Col key={storehouse.storehouseId}>
                        <Card>
                            <Card.Body>
                                <Card.Title>{storehouse.storehouseName}</Card.Title>
                                <Card.Subtitle className="mb-2 text-muted">
                                    ID: {storehouse.storehouseId}
                                </Card.Subtitle>
                                <Card.Text>
                                    <strong>Location:</strong> {storehouse.location}
                                    <br />
                                    <strong>Size:</strong> {storehouse.size_m2} m²
                                </Card.Text>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Add Storehouse Form */}
            <Form onSubmit={handleCreateStorehouse}>
                <Form.Group className="mb-3">
                    <Form.Label>New Storehouse Name</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Enter name"
                        value={newStorehouseName}
                        onChange={(e) => setNewStorehouseName(e.target.value)}
                        required
                    />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>New Location</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="Enter location"
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        required
                    />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>New Size (m²)</Form.Label>
                    <Form.Control
                        type="number"
                        placeholder="Enter size in m²"
                        value={newSize_m2}
                        onChange={(e) => setNewSize_m2(e.target.value)}
                        required
                    />
                </Form.Group>

                <Button variant="primary" type="submit">
                    Create Storehouse
                </Button>
            </Form>
        </div>
    );
}

export default MyStorehouses;