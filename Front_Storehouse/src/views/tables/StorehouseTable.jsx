import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Button, Form } from 'react-bootstrap';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Exported Endpoint
export const StoreHouseEndPoint = `https://localhost:7204/api/Storehouses`;

const StorehouseTable = () => {
    const [storehouses, setStorehouses] = useState([]);
    const [newStorehouse, setNewStorehouse] = useState({
        storehouseName: '',
        location: '',
        size_m2: 0,
        companiesId: 1, // Default value, make dynamic below.
    });
    const [companies, setCompanies] = useState([]); // State to store companies
    const [loading, setLoading] = useState(true); // State to manage loading
    const [error, setError] = useState(null);       // State to manage errors

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null); // Clear any previous errors
            try {
                const storehousesResponse = await axios.get(StoreHouseEndPoint);
                setStorehouses(storehousesResponse.data);

                const companiesResponse = await axios.get('https://localhost:7204/api/Companies'); // Replace with your Companies API URL
                setCompanies(companiesResponse.data);
                if (companiesResponse.data.length > 0) {
                    setNewStorehouse(prevState => ({
                        ...prevState,
                        companiesId: companiesResponse.data[0].companyId
                    }))
                }

            } catch (err) {
                console.error("Error fetching data:", err);
                setError(err); // Set the error state
                toast.error(`Error fetching data: ${err.message}`); // Display error toast
            } finally {
                setLoading(false); // Set loading to false regardless of success or failure
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
        try {
            await axios.post(StoreHouseEndPoint, newStorehouse);
            // After successful submission, reload storehouses and optionally reset the form
            const storehousesResponse = await axios.get(StoreHouseEndPoint);
            setStorehouses(storehousesResponse.data);
            setNewStorehouse({
                storehouseName: '',
                location: '',
                size_m2: 0,
                companiesId: companies.length > 0 ? companies[0].companyId : 1, // Reset to first Company ID or default
            });
            toast.success('Storehouse added successfully!');  // Success toast
        } catch (error) {
            console.error('Error adding storehouse:', error);
            setError(error); // Set the error state
            toast.error(`Error adding storehouse: ${error.message}`); // Display error toast
        }
    };

    if (loading) {
        return <div>Loading storehouses and companies...</div>;
    }

    if (error) {
        return <div>Error: {error.message}</div>;
    }

    return (
        <React.Fragment>
            <Row>
                <Col>
                    <Card>
                        <Card.Header>
                            <Card.Title as="h5">Storehouses</Card.Title>
                        </Card.Header>
                        <Card.Body>
                            <Table striped bordered hover responsive>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Name</th>
                                        <th>Location</th>
                                        <th>Size (m²)</th>
                                        <th>Company ID</th>
                                    </tr>
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

            {/* Add Storehouse Form */}
            <Row>
                <Col>
                    <Card>
                        <Card.Header>
                            <Card.Title as="h5">Add New Storehouse</Card.Title>
                        </Card.Header>
                        <Card.Body>
                            <Form onSubmit={handleSubmit}>
                                <Form.Group controlId="storehouseName">
                                    <Form.Label>Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="storehouseName"
                                        value={newStorehouse.storehouseName}
                                        onChange={handleInputChange}
                                        placeholder="Enter name"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group controlId="location">
                                    <Form.Label>Location</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="location"
                                        value={newStorehouse.location}
                                        onChange={handleInputChange}
                                        placeholder="Enter location"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group controlId="size_m2">
                                    <Form.Label>Size (m²)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="size_m2"
                                        value={newStorehouse.size_m2}
                                        onChange={handleInputChange}
                                        placeholder="Enter size"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group controlId="companiesId">
                                    <Form.Label>Company ID</Form.Label>
                                    <Form.Control
                                        as="select"
                                        name="companiesId"
                                        value={newStorehouse.companiesId}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        {companies.map((company) => (
                                            <option key={company.companyId} value={company.companyId}>
                                                {company.name} (ID: {company.companyId})
                                            </option>
                                        ))}
                                    </Form.Control>
                                </Form.Group>

                                <Button variant="primary" type="submit">
                                    Add Storehouse
                                </Button>
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