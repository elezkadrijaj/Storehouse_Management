import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import apiClient from '../../appService'; // REFACTORED: Import the centralized apiClient

// Note: The direct import for 'axios' and the StoreHouseEndPoint export have been removed.

const SESSION_STORAGE_KEYS = { TOKEN: 'authToken' };

const StorehouseTable = () => {
    const [storehouses, setStorehouses] = useState([]);
    const [newStorehouse, setNewStorehouse] = useState({
        storehouseName: '',
        location: '',
        size_m2: '', // Use string for form input
        companiesId: '', // Start empty, will be set from fetched companies
    });
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            
            const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
            if (!token) {
                setError("Authentication required. Please log in.");
                setLoading(false);
                return;
            }
            const config = { headers: { Authorization: `Bearer ${token}` } };

            try {
                // REFACTORED: Use Promise.all for more efficient, parallel data fetching.
                const [storehousesResponse, companiesResponse] = await Promise.all([
                    apiClient.get('/Storehouses', config),
                    apiClient.get('/Companies', config) 
                ]);

                setStorehouses(storehousesResponse.data);
                setCompanies(companiesResponse.data);

                // Set default company for the form if companies exist
                if (companiesResponse.data.length > 0) {
                    setNewStorehouse(prevState => ({
                        ...prevState,
                        companiesId: companiesResponse.data[0].companyId
                    }));
                }
            } catch (err) {
                console.error("Error fetching data:", err);
                const errorMessage = err.response?.data?.message || err.message || "Failed to fetch initial data.";
                setError(errorMessage);
                toast.error(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setNewStorehouse({ ...newStorehouse, [name]: value });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        
        const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
        if (!token) {
            toast.error("Authentication required.");
            return;
        }
        const config = { headers: { Authorization: `Bearer ${token}` } };
        
        // Basic validation
        if (!newStorehouse.storehouseName || !newStorehouse.location || !newStorehouse.size_m2 || !newStorehouse.companiesId) {
            toast.warn("Please fill out all fields.");
            return;
        }

        try {
            // BEST PRACTICE: The API should return the newly created object.
            const response = await apiClient.post('/Storehouses', {
                ...newStorehouse,
                size_m2: parseFloat(newStorehouse.size_m2) // Ensure size is a number
            }, config);
            
            // BEST PRACTICE: Update state directly from the response instead of re-fetching.
            setStorehouses(prevStorehouses => [...prevStorehouses, response.data]);
            
            // Reset form
            setNewStorehouse({
                storehouseName: '',
                location: '',
                size_m2: '',
                companiesId: companies.length > 0 ? companies[0].companyId : '',
            });
            toast.success('Storehouse added successfully!');
        } catch (err) {
            console.error('Error adding storehouse:', err);
            const errorMessage = err.response?.data?.title || err.response?.data?.message || "Error adding storehouse.";
            setError(errorMessage);
            toast.error(errorMessage);
        }
    };

    if (loading) {
        return <div className="d-flex justify-content-center mt-5"><Spinner animation="border" /><p className="ms-3">Loading data...</p></div>;
    }

    if (error) {
        return <Alert variant="danger" className="mt-4">Error: {error}</Alert>;
    }

    return (
        <React.Fragment>
            <Row>
                <Col>
                    <Card>
                        <Card.Header><Card.Title as="h5">Storehouses</Card.Title></Card.Header>
                        <Card.Body>
                            <Table striped bordered hover responsive>
                                <thead>
                                    <tr><th>ID</th><th>Name</th><th>Location</th><th>Size (m²)</th><th>Company ID</th></tr>
                                </thead>
                                <tbody>
                                    {storehouses.map((storehouse) => (
                                        <tr key={storehouse.storehouseId}>
                                            <td>{storehouse.storehouseId}</td>
                                            <td>{storehouse.storehouseName}</td>
                                            <td>{storehouse.location}</td>
                                            <td>{storehouse.size_m2}</td>
                                            <td>{storehouse.companiesId}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Row className="mt-4">
                <Col>
                    <Card>
                        <Card.Header><Card.Title as="h5">Add New Storehouse</Card.Title></Card.Header>
                        <Card.Body>
                            <Form onSubmit={handleSubmit}>
                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-3" controlId="storehouseName">
                                            <Form.Label>Name</Form.Label>
                                            <Form.Control type="text" name="storehouseName" value={newStorehouse.storehouseName} onChange={handleInputChange} placeholder="Enter name" required />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3" controlId="location">
                                            <Form.Label>Location</Form.Label>
                                            <Form.Control type="text" name="location" value={newStorehouse.location} onChange={handleInputChange} placeholder="Enter location" required />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-3" controlId="size_m2">
                                            <Form.Label>Size (m²)</Form.Label>
                                            <Form.Control type="number" name="size_m2" value={newStorehouse.size_m2} onChange={handleInputChange} placeholder="Enter size" min="0" required />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3" controlId="companiesId">
                                            <Form.Label>Company</Form.Label>
                                            <Form.Control as="select" name="companiesId" value={newStorehouse.companiesId} onChange={handleInputChange} required>
                                                {companies.map((company) => (
                                                    <option key={company.companyId} value={company.companyId}>{company.name}</option>
                                                ))}
                                            </Form.Control>
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Button variant="primary" type="submit">Add Storehouse</Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
            <ToastContainer />
        </React.Fragment>
    );
};

export default StorehouseTable;