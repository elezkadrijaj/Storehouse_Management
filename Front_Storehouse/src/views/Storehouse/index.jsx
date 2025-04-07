import React, { useState, useEffect } from 'react';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils'; // Adjust path if needed
import { Form, Button, Modal, Card, Row, Col } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';

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

    const navigate = useNavigate();

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
                const config = { headers: { Authorization: `Bearer ${token}` } };
                // Assuming this endpoint gets storehouses for the logged-in company manager
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
                    console.error("Error fetching storehouses:", err);
                    setError(err.response?.data?.message || err.response?.data || err.message || 'An unexpected error occurred.');
                    setLoading(false);
                    setStorehouses([]);
                }
            }
        };
        fetchStorehouses();
        return () => { isMounted = false; };
    }, []);

    const handleCreateStorehouse = async () => {
        try {
            const token = cookieUtils.getCookie('token');
            if (!token) { toast.error('No token found. Please log in.'); return; }
            if (!newStorehouseName.trim() || !newLocation.trim() || !newSize_m2) {
                 toast.warn('Please fill in all fields.');
                 return;
            }

            const config = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
            const companyID = localStorage.getItem("companyID"); // Ensure this is reliable
             if (!companyID) {
                 toast.error('Company ID not found. Cannot create storehouse.');
                 return;
             }

            const newStorehouse = {
                storehouseName: newStorehouseName,
                location: newLocation,
                size_m2: parseInt(newSize_m2, 10),
                companiesId: parseInt(companyID, 10) // Parse company ID too
            };

            const response = await axios.post('https://localhost:7204/api/Storehouses', newStorehouse, config);
            toast.success('Storehouse created successfully!');

            // Add new storehouse to state for immediate UI update
            setStorehouses([...storehouses, response.data]); // Assumes API returns the created object

            setNewStorehouseName('');
            setNewLocation('');
            setNewSize_m2('');
            handleCloseModal();
        } catch (err) {
             console.error("Create Storehouse Error:", err);
             toast.error(err.response?.data?.message || err.response?.data || err.message || 'Error creating Storehouse.');
        }
    };

    const handleOpenModal = () => setShowModal(true);
    const handleCloseModal = () => {
        setShowModal(false);
        setNewStorehouseName('');
        setNewLocation('');
        setNewSize_m2('');
    };

    const handleDeleteStorehouse = async (id) => {
        // Optional: Add a confirmation dialog here before deleting
        if (!window.confirm("Are you sure you want to delete this storehouse and all its contents?")) {
             return;
        }

        setDeletingId(id);
        try {
            const token = cookieUtils.getCookie('token');
            if (!token) { toast.error('No token found. Please log in.'); setDeletingId(null); return; }
            const config = { headers: { Authorization: `Bearer ${token}` } };

            await axios.delete(`https://localhost:7204/api/Storehouses/${id}`, config);
            toast.success('Storehouse deleted successfully!');
            setStorehouses(storehouses.filter((storehouse) => storehouse.storehouseId !== id));
        } catch (err) {
            console.error('Delete Error:', err);
            toast.error(err.response?.data?.message || err.response?.data || err.message || 'Error deleting storehouse.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleOpenEditModal = (storehouse) => {
        setEditingId(storehouse.storehouseId);
        setEditStorehouseName(storehouse.storehouseName);
        setEditLocation(storehouse.location);
        setEditSize_m2(storehouse.size_m2 ? storehouse.size_m2.toString() : ''); // Handle potential null/undefined size
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
        if (!editingId) return;
        try {
            const token = cookieUtils.getCookie('token');
            if (!token) { toast.error('No token found. Please log in.'); return; }
            if (!editStorehouseName.trim() || !editLocation.trim() || !editSize_m2) {
                toast.warn('Please fill in all fields.');
                return;
            }

            const config = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
            const companyID = localStorage.getItem("companyID");
            if (!companyID) {
                toast.error('Company ID not found. Cannot update storehouse.');
                return;
            }

            const updatedStorehouse = {
                storehouseId: editingId,
                storehouseName: editStorehouseName,
                location: editLocation,
                size_m2: parseInt(editSize_m2, 10),
                companiesId: parseInt(companyID, 10)
            };

            // Assuming API returns the updated object or confirms success
            await axios.put(`https://localhost:7204/api/Storehouses/${editingId}`, updatedStorehouse, config);
            toast.success('Storehouse updated successfully!');

            // Update state locally
            setStorehouses(
                storehouses.map((storehouse) =>
                    storehouse.storehouseId === editingId ? { ...storehouse, ...updatedStorehouse } : storehouse // Merge updates
                )
            );
            handleCloseEditModal();
        } catch (err) {
            console.error('Update Error:', err);
            toast.error(err.response?.data?.message || err.response?.data || err.message || 'Error updating storehouse.');
        }
    };

    // --- Navigation Handler for Sections ---
    const handleViewSections = (storehouseId) => {
        // Ensure the target route exists and can handle the storehouseId
        navigate(`/app/sections?storehouseId=${storehouseId}`);
    };

    // --- Navigation Handler for Workers ---
    const handleSeeWorkers = (storehouseId) => {
        // IMPORTANT: Ensure the target route '/app/storehouseworkers' exists
        // AND the component at that route is modified to use the storehouseId parameter
        // to fetch workers for THAT specific storehouse.
        navigate(`/app/storehouseworkers?storehouseId=${storehouseId}`);
    };

    if (loading) {
        // Add a spinner or better loading indicator if desired
        return <div className="container mt-4">Loading storehouses...</div>;
    }

    if (error) {
        return <div className="container mt-4 alert alert-danger">Error: {error}</div>;
    }

    return (
        <div className="container mt-4"> {/* Added margin top */}
            <div className="d-flex justify-content-between align-items-center mb-3"> {/* Header alignment */}
                <h2>My Storehouses</h2>
                <Button variant="success" onClick={handleOpenModal}> {/* Changed variant */}
                    <i className="bi bi-plus-lg me-1"></i> Create Storehouse {/* Optional Icon */}
                </Button>
            </div>
            <ToastContainer position="top-right" autoClose={3000} /> {/* Reduced autoClose */}

            {storehouses.length === 0 && !loading && (
                 <Alert variant="info">You currently have no storehouses created.</Alert>
            )}

            <Row xs={1} md={2} lg={3} className="g-4">
                {storehouses.map((storehouse) => (
                    <Col key={storehouse.storehouseId}>
                        <Card className="h-100"> {/* Ensure cards have same height */}
                            <Card.Body className="d-flex flex-column"> {/* Flex column layout */}
                                <Card.Title>{storehouse.storehouseName}</Card.Title>
                                <Card.Text className="flex-grow-1"> {/* Allow text to grow */}
                                    <strong>Location:</strong> {storehouse.location || 'N/A'}
                                    <br />
                                    <strong>Size:</strong> {storehouse.size_m2 ? `${storehouse.size_m2} m²` : 'N/A'}
                                </Card.Text>
                                <div className="mt-auto d-flex flex-wrap gap-2 justify-content-center"> {/* Button group at bottom */}
                                    <Button
                                        size="sm"
                                        variant="outline-info"
                                        onClick={() => handleViewSections(storehouse.storehouseId)}
                                    >
                                        View Sections
                                    </Button>
                                    {/* --- ADDED SEE WORKERS BUTTON --- */}
                                    <Button
                                        size="sm"
                                        variant="outline-secondary" // Choose a variant
                                        onClick={() => handleSeeWorkers(storehouse.storehouseId)}
                                    >
                                        See Workers
                                    </Button>
                                    {/* --- END ADDED BUTTON --- */}
                                     <Button
                                        size="sm"
                                        variant="outline-warning"
                                        onClick={() => handleOpenEditModal(storehouse)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline-danger"
                                        onClick={() => handleDeleteStorehouse(storehouse.storehouseId)}
                                        disabled={deletingId === storehouse.storehouseId}
                                    >
                                        {deletingId === storehouse.storehouseId ? 'Deleting...' : 'Delete'}
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Create Modal */}
            <Modal show={showModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Create New Storehouse</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                     <Form onSubmit={(e) => { e.preventDefault(); handleCreateStorehouse(); }}>
                        <Form.Group className="mb-3">
                            <Form.Label>Storehouse Name</Form.Label>
                            <Form.Control
                                type="text" placeholder="Enter name" value={newStorehouseName}
                                onChange={(e) => setNewStorehouseName(e.target.value)} required autoFocus/>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Location</Form.Label>
                            <Form.Control
                                type="text" placeholder="Enter location" value={newLocation}
                                onChange={(e) => setNewLocation(e.target.value)} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Size (m²)</Form.Label>
                            <Form.Control
                                type="number" placeholder="Enter size" value={newSize_m2} min="1" step="any" // Added min/step
                                onChange={(e) => setNewSize_m2(e.target.value)} required />
                        </Form.Group>
                         <Modal.Footer>
                            <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                            <Button variant="primary" type="submit">Create Storehouse</Button>
                        </Modal.Footer>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* Edit Modal */}
            <Modal show={showEditModal} onHide={handleCloseEditModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Storehouse</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={(e) => { e.preventDefault(); handleUpdateStorehouse(); }}>
                        <Form.Group className="mb-3">
                            <Form.Label>Storehouse Name</Form.Label>
                            <Form.Control
                                type="text" placeholder="Enter name" value={editStorehouseName}
                                onChange={(e) => setEditStorehouseName(e.target.value)} required autoFocus />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Location</Form.Label>
                            <Form.Control
                                type="text" placeholder="Enter location" value={editLocation}
                                onChange={(e) => setEditLocation(e.target.value)} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Size (m²)</Form.Label>
                            <Form.Control
                                type="number" placeholder="Enter size" value={editSize_m2} min="1" step="any"
                                onChange={(e) => setEditSize_m2(e.target.value)} required />
                        </Form.Group>
                         <Modal.Footer>
                            <Button variant="secondary" onClick={handleCloseEditModal}>Cancel</Button>
                            <Button variant="primary" type="submit">Update Storehouse</Button>
                        </Modal.Footer>
                    </Form>
                </Modal.Body>
            </Modal>
        </div>
    );
}

export default MyStorehouses;