import React, { useState, useEffect } from 'react';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils';
import { Form, Button, Modal, Card, Row, Col } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

function MyStorehouses() {
    const [storehouses, setStorehouses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newStorehouseName, setNewStorehouseName] = useState('');
    const [newLocation, setNewLocation] = useState('');
    const [newSize_m2, setNewSize_m2] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editStorehouseName, setEditStorehouseName] = useState('');
    const [editLocation, setEditLocation] = useState('');
    const [editSize_m2, setEditSize_m2] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);

    const navigate = useNavigate(); // Initialize useNavigate

    useEffect(() => {
        let isMounted = true;

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

                if (isMounted) {
                    if (Array.isArray(response.data)) {
                        setStorehouses(response.data);
                    } else {
                        console.error("API did not return an array:", response.data);
                        setStorehouses([]);
                        setError("Failed to load storehouses: API returned unexpected data.");
                    }
                    setLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    console.log("CATCH:", err);
                    setError(err.response?.data || err.message || 'An unexpected error occurred.');
                    setLoading(false);
                    setStorehouses([]);
                }
            }
        };

        fetchStorehouses()

        return () => {
            isMounted = false;
        };
    }, []);

    const handleCreateStorehouse = async () => {
        try {
            const token = cookieUtils.getCookie('token');

            if (!token) {
                toast.error('No token found. Please log in.');
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
                companiesId: localStorage.getItem("companyID")
            };

            const response = await axios.post('https://localhost:7204/api/Storehouses', newStorehouse, config);
            console.log('StoreHouse created successful!');
            toast.success('StoreHouse created successful!');
            setNewStorehouseName('');
            setNewLocation('');
            setNewSize_m2('');

            handleCloseModal();

        } catch (err) {
            toast.error(err.response?.data || err.message || 'Error creating Storehouse. Please try again later.');
        }

    };


    const handleOpenModal = () => {
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setNewStorehouseName('');
        setNewLocation('');
        setNewSize_m2('');
    };

    const handleDeleteStorehouse = async (id) => {
        setDeletingId(id);

        try {
            const token = cookieUtils.getCookie('token');

            if (!token) {
                toast.error('No token found. Please log in.');
                setDeletingId(null);
                return;
            }

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            };

            await axios.delete(`https://localhost:7204/api/Storehouses/${id}`, config);
            console.log('Storehouse deleted successfully!');
            toast.success('Storehouse deleted successfully!');

            setStorehouses(storehouses.filter((storehouse) => storehouse.storehouseId !== id));
        } catch (err) {
            console.error('Delete Error:', err); // Log the error
            toast.error(err.response?.data || err.message || 'Error deleting storehouse. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleOpenEditModal = (storehouse) => {
        setEditingId(storehouse.storehouseId);
        setEditStorehouseName(storehouse.storehouseName);
        setEditLocation(storehouse.location);
        setEditSize_m2(storehouse.size_m2.toString()); // Convert to string for controlled input
        setShowEditModal(true);
    };

    const handleCloseEditModal = () => {
        setShowEditModal(false);
        setEditingId(null);
        setEditStorehouseName('');
        setEditLocation('');
        setEditSize_m2('');
    };

    const handleUpdateStorehouse = async () => {
        try {
            const token = cookieUtils.getCookie('token');

            if (!token) {
                toast.error('No token found. Please log in.');
                return;
            }

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            };

            const updatedStorehouse = {
                storehouseId: editingId,
                storehouseName: editStorehouseName,
                location: editLocation,
                size_m2: parseInt(editSize_m2, 10),
                companiesId: localStorage.getItem("companyID")
            };

            await axios.put(`https://localhost:7204/api/Storehouses/${editingId}`, updatedStorehouse, config);
            console.log('Storehouse updated successfully!');
            toast.success('Storehouse updated successfully!');

            setStorehouses(
                storehouses.map((storehouse) =>
                    storehouse.storehouseId === editingId ? updatedStorehouse : storehouse
                )
            );

            handleCloseEditModal();
        } catch (err) {
            console.error('Update Error:', err); // Log the error
            console.log("Full error response:", err.response);
            toast.error(err.response?.data || err.message || 'Error updating storehouse. Please try again.');
        }
    };

    const handleViewSections = (storehouseId) => {
        navigate(`/app/sections?storehouseId=${storehouseId}`); // Navigate to the sections route with storehouseId
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
            <ToastContainer position="top-right" autoClose={5000} />
            <Row xs={1} md={2} lg={3} className="g-4">
                {storehouses.map((storehouse) => (
                    <Col key={storehouse.storehouseId}>
                        <Card>
                            <Card.Body>
                                <Card.Title>{storehouse.storehouseName}</Card.Title>
                                <Card.Subtitle className="mb-2 text-muted">
                                </Card.Subtitle>
                                <Card.Text>
                                    <strong>Location:</strong> {storehouse.location}
                                    <br />
                                    <strong>Size:</strong> {storehouse.size_m2} m²
                                </Card.Text>
                                <Button
                                    variant="primary"
                                    onClick={() => handleViewSections(storehouse.storehouseId)}
                                    style={{ marginRight: '5px' }}
                                >
                                    View Sections
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => handleOpenEditModal(storehouse)}
                                    style={{ marginRight: '5px' }}
                                >
                                    Edit
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={() => handleDeleteStorehouse(storehouse.storehouseId)}
                                    disabled={deletingId === storehouse.storehouseId}
                                >
                                    {deletingId === storehouse.storehouseId ? 'Deleting...' : 'Delete'}
                                </Button>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Button variant="primary" onClick={handleOpenModal}>
                Create Storehouse
            </Button>

            <Modal show={showModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Create New Storehouse</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Storehouse Name</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter name"
                                value={newStorehouseName}
                                onChange={(e) => setNewStorehouseName(e.target.value)}
                                required
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Location</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter location"
                                value={newLocation}
                                onChange={(e) => setNewLocation(e.target.value)}
                                required
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Size (m²)</Form.Label>
                            <Form.Control
                                type="number"
                                placeholder="Enter size in m²"
                                value={newSize_m2}
                                onChange={(e) => setNewSize_m2(e.target.value)}
                                required
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleCreateStorehouse}>
                        Create Storehouse
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showEditModal} onHide={handleCloseEditModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Storehouse</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Storehouse Name</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter name"
                                value={editStorehouseName}
                                onChange={(e) => setEditStorehouseName(e.target.value)}
                                required
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Location</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter location"
                                value={editLocation}
                                onChange={(e) => setEditLocation(e.target.value)}
                                required
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Size (m²)</Form.Label>
                            <Form.Control
                                type="number"
                                placeholder="Enter size in m²"
                                value={editSize_m2}
                                onChange={(e) => setEditSize_m2(e.target.value)}
                                required
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseEditModal}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleUpdateStorehouse}>
                        Update Storehouse
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default MyStorehouses;