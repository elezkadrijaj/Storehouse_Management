import React, { useState, useEffect } from 'react';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils'; // Adjust path if needed
import { Form, Button, Modal, Card, Row, Col, Alert } from 'react-bootstrap';
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
                const token = cookieUtils.getTokenFromCookies(); // Use dedicated getter
                if (!token) {
                    setError('No token found. Please log in.');
                    setLoading(false);
                    return;
                }
                const config = { headers: { Authorization: `Bearer ${token}` } };
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
                    let errorMessage = 'An unexpected error occurred.';
                    if (err.response) {
                        errorMessage = `Error: ${err.response.status} - ${err.response.data?.message || err.response.data || 'Server error'}`;
                        if (err.response.status === 401 || err.response.status === 403) {
                             errorMessage = 'Authentication error. Please log in again.';
                             // Consider redirecting to login: navigate('/login');
                        }
                    } else if (err.request) {
                        errorMessage = 'Could not connect to the server. Please check your network.';
                    } else {
                        errorMessage = err.message;
                    }
                    setError(errorMessage);
                    setLoading(false);
                    setStorehouses([]);
                }
            }
        };
        fetchStorehouses();
        return () => { isMounted = false; };
    }, [navigate]);

    const handleCreateStorehouse = async () => {
        // --- Input Validation ---
        const size = Number(newSize_m2); // Use Number() for flexibility
         if (!newStorehouseName || !newLocation || !newSize_m2) {
             toast.warn('Please fill in all fields.');
             return;
         }
         if (isNaN(size) || size <= 0) {
             toast.warn('Please enter a valid positive size.');
             return;
         }

        // --- API Call ---
        try {
            const token = cookieUtils.getTokenFromCookies();
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

            // Prepare the data to send
            const newStorehouseData = {
                storehouseName: newStorehouseName,
                location: newLocation,
                size_m2: size, // Send the parsed number
                companiesId: localStorage.getItem("companyID")
            };

            // Make the POST request and *capture the response*
            const response = await axios.post('https://localhost:7204/api/Storehouses', newStorehouseData, config);

            // --- Update State on Success ---
            // Check if the backend returned the created storehouse data (common practice for POST)
            if (response.data && response.data.storehouseId) {
                console.log('Storehouse created successfully:', response.data);
                toast.success('Storehouse created successfully!');

                // Add the newly created storehouse to the state
                // Use functional update to ensure you're working with the latest state
                setStorehouses(currentStorehouses => [
                    ...currentStorehouses, // Keep existing storehouses
                    response.data        // Add the new one returned from the API
                ]);

                // Clear the form and close the modal
                handleCloseModal();

            } else {
                // Handle cases where the backend might not return the full object (less ideal)
                console.warn('Storehouse created, but response data might be incomplete:', response.data);
                toast.success('Storehouse created! Refresh may be needed to see it.');
                 // Optionally, you could trigger a re-fetch here, but updating directly is better if possible
                 // fetchStorehouses(); // This would work but is less efficient than using the response
                 handleCloseModal();
            }

        } catch (err) {
            console.error("Create Storehouse Error:", err);
            console.log("Full error response:", err.response);
             // Keep your existing robust error handling
             let errorMessage = 'Error creating Storehouse. Please try again later.';
              if (err.response) {
                 errorMessage = err.response.data?.message || err.response.data?.title || err.response.data || `Server Error: ${err.response.status}`;
                  if (err.response.status === 400 && typeof err.response.data === 'object' && err.response.data?.errors) {
                      const validationErrors = Object.values(err.response.data.errors).flat().join(' ');
                      errorMessage = `Validation failed: ${validationErrors}`;
                  } else if (err.response.status === 401 || err.response.status === 403) {
                       errorMessage = 'Authentication error or permission denied.';
                  }
             } else if (err.request) {
                 errorMessage = 'Could not connect to the server.';
             } else {
                 errorMessage = err.message;
             }
            toast.error(errorMessage);
            // Do NOT close modal on error, let the user fix input
        }
        // Note: Clearing fields is moved inside the success block of the try/catch
        // and into handleCloseModal to avoid clearing on error.
    };

    const handleOpenModal = () => setShowModal(true);
    const handleCloseModal = () => {
        setShowModal(false);
        setNewStorehouseName('');
        setNewLocation('');
        setNewSize_m2('');
    };

    const handleDeleteStorehouse = async (id) => {
        if (!id) return;

        if (!window.confirm("Are you sure you want to delete this storehouse and all its related data? This action cannot be undone.")) {
             return;
        }

        setDeletingId(id);
        try {
            const token = cookieUtils.getTokenFromCookies();
            if (!token) {
                toast.error('Authentication error. Please log in again.');
                setDeletingId(null);
                return;
             }
            const config = { headers: { Authorization: `Bearer ${token}` } };

            const response = await axios.delete(`https://localhost:7204/api/Storehouses/${id}`, config);

             if (response.status === 200 || response.status === 204) {
                toast.success('Storehouse deleted successfully!');
                setStorehouses(currentStorehouses => currentStorehouses.filter((storehouse) => storehouse.storehouseId !== id));
            } else {
                 console.error("Delete Storehouse - Unexpected success response:", response);
                 toast.error('Storehouse deleted, but received an unexpected response from the server.');
            }

        } catch (err) {
            console.error('Delete Error:', err);
             let errorMessage = 'Error deleting storehouse.';
             if (err.response) {
                 errorMessage = `Error: ${err.response.status} - ${err.response.data?.message || err.response.data?.title || err.response.data || 'Server error'}`;
                 if (err.response.status === 401 || err.response.status === 403) {
                     errorMessage = 'Authentication error or insufficient permissions.';
                 } else if (err.response.status === 404) {
                      errorMessage = 'Storehouse not found. It might have already been deleted.';
                      setStorehouses(currentStorehouses => currentStorehouses.filter((storehouse) => storehouse.storehouseId !== id));
                 }
             } else if (err.request) {
                 errorMessage = 'Could not connect to the server.';
             } else {
                 errorMessage = err.message;
             }
            toast.error(errorMessage);
        } finally {
            setDeletingId(null);
        }
    };

    const handleOpenEditModal = (storehouse) => {
        if (!storehouse) return;
        setEditingId(storehouse.storehouseId);
        setEditStorehouseName(storehouse.storehouseName || '');
        setEditLocation(storehouse.location || '');
        setEditSize_m2(storehouse.size_m2 ? storehouse.size_m2.toString() : '');
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
        // --- Input Validation ---
        if (!editingId) {
            toast.error('Cannot update: Storehouse ID is missing.');
            console.error("Update failed: editingId is null or undefined.");
            return;
        }
        if (!editStorehouseName || !editLocation || !editSize_m2) {
             toast.warn('Please fill in all fields.');
             return;
        }
        const size = Number(editSize_m2); // Use Number() for flexibility with decimals
        if (isNaN(size) || size <= 0) {
            toast.warn('Please enter a valid positive size.');
            return;
        }

        // --- API Call ---
        try {
            // Use consistent token retrieval
            const token = cookieUtils.getTokenFromCookies();

            if (!token) {
                // Use toast consistently for user feedback
                toast.error('Authentication error. Please log in again.');
                // Removed setErrorMessage as it's not defined in the provided scope
                return;
            }

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            };

            // **Construct the DTO payload - ONLY send fields expected by the backend DTO**
            const updateDto = {
                storehouseName: editStorehouseName,
                location: editLocation,
                size_m2: size, // Use the validated and converted number
                // DO NOT send storehouseId or companiesId in the request body
            };

            // Make the PUT request with ID in URL and DTO in body
            await axios.put(`https://localhost:7204/api/Storehouses/${editingId}`, updateDto, config);

            console.log('Storehouse updated successfully!');
            toast.success('Storehouse updated successfully!');

            // **Update local state correctly**
            // Find the storehouse and merge the updated fields
            setStorehouses(currentStorehouses =>
                currentStorehouses.map((storehouse) => {
                    if (storehouse.storehouseId === editingId) {
                        // Return a *new* object with existing fields merged with updated ones
                        return {
                            ...storehouse,         // Keep original fields (like storehouseId, companiesId)
                            storehouseName: updateDto.storehouseName, // Update changed field
                            location: updateDto.location,         // Update changed field
                            size_m2: updateDto.size_m2            // Update changed field
                        };
                    }
                    return storehouse; // Return other storehouses unchanged
                })
            );

            handleCloseEditModal(); // Close modal on success

        } catch (err) {
            console.error('Update Error:', err);
            console.log("Full error response:", err.response); // Keep this for debugging

            // More robust error message handling
            let errorMessage = 'Error updating storehouse. Please try again.';
            if (err.response) {
                 // Try to get specific message from backend first
                 errorMessage = err.response.data?.message || err.response.data?.title || err.response.data || `Server Error: ${err.response.status}`;
                 if (err.response.status === 400 && typeof err.response.data === 'object' && err.response.data?.errors) {
                     // Handle validation errors from ASP.NET Core ModelState
                     const validationErrors = Object.values(err.response.data.errors).flat().join(' ');
                     errorMessage = `Validation failed: ${validationErrors}`;
                 } else if (err.response.status === 401) {
                      errorMessage = 'Authentication error. Please log in again.';
                 } else if (err.response.status === 403) {
                      errorMessage = 'You do not have permission to perform this action.';
                 } else if (err.response.status === 404) {
                      errorMessage = 'Storehouse not found. It might have been deleted.';
                 } else if (err.response.status === 409) { // Handle concurrency conflict if backend returns 409
                      errorMessage = 'Conflict: The storehouse data has changed since you loaded it. Please refresh and try again.';
                 }
            } else if (err.request) {
                errorMessage = 'Could not connect to the server. Please check your network.';
            } else {
                errorMessage = err.message; // General JS error
            }
            toast.error(errorMessage);
        }
    };

    const handleViewSections = (storehouseId) => {
         if (!storehouseId) return;
        navigate(`/app/sections?storehouseId=${storehouseId}`);
    };

    const handleSeeWorkers = (storehouseId) => {
         if (!storehouseId) return;
        navigate(`/app/storehouseworkers?storehouseId=${storehouseId}`);
    };

    if (loading) {
        return <div className="container mt-4">Loading storehouses...</div>;
    }

    if (error) {
        return <div className="container mt-4"><Alert variant="danger">Error loading storehouses: {error}</Alert></div>;
    }

    return (
        <div className="container mt-4">
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />

            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>My Storehouses</h2>
                <Button variant="success" onClick={handleOpenModal}>
                     Create Storehouse
                </Button>
            </div>

            {storehouses.length === 0 && !loading && (
                 <Alert variant="info" className="text-center">You currently have no storehouses created. Click 'Create Storehouse' to add one.</Alert>
            )}

            <Row xs={1} sm={1} md={2} lg={3} xl={4} className="g-4">
                {storehouses.map((storehouse) => (
                    <Col key={storehouse.storehouseId}>
                        <Card className="h-100 shadow-sm">
                            <Card.Body className="d-flex flex-column">
                                <Card.Title className="mb-3">{storehouse.storehouseName || 'Unnamed Storehouse'}</Card.Title>
                                <Card.Text className="text-muted flex-grow-1 mb-3">
                                    <strong>Location:</strong> {storehouse.location || 'N/A'}
                                    <br />
                                    <strong>Size:</strong> {storehouse.size_m2 ? `${storehouse.size_m2.toLocaleString()} m²` : 'N/A'}
                                </Card.Text>
                                <div className="mt-auto d-flex flex-wrap gap-2 justify-content-center border-top pt-3">
                                    <Button
                                        size="sm"
                                        variant="outline-primary"
                                        onClick={() => handleViewSections(storehouse.storehouseId)}
                                        title="View Sections"
                                    >
                                        Sections
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline-secondary"
                                        onClick={() => handleSeeWorkers(storehouse.storehouseId)}
                                        title="See Assigned Workers"
                                    >
                                        Workers
                                    </Button>
                                     <Button
                                        size="sm"
                                        variant="outline-warning"
                                        onClick={() => handleOpenEditModal(storehouse)}
                                        title="Edit Storehouse Details"
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline-danger"
                                        onClick={() => handleDeleteStorehouse(storehouse.storehouseId)}
                                        disabled={deletingId === storehouse.storehouseId}
                                        title="Delete Storehouse"
                                    >
                                        {deletingId === storehouse.storehouseId ? 'Deleting...' : 'Delete'}
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Create Storehouse Modal */}
            <Modal show={showModal} onHide={handleCloseModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton>
                    <Modal.Title>Create New Storehouse</Modal.Title>
                </Modal.Header>
                 <Form noValidate onSubmit={(e) => { e.preventDefault(); handleCreateStorehouse(); }}>
                    <Modal.Body>
                        <Form.Group className="mb-3" controlId="createStorehouseName">
                            <Form.Label>Storehouse Name</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter name (e.g., Main Warehouse)"
                                value={newStorehouseName}
                                onChange={(e) => setNewStorehouseName(e.target.value)}
                                required
                                autoFocus
                                maxLength={100}
                            />
                             <Form.Control.Feedback type="invalid">Please provide a name.</Form.Control.Feedback>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="createLocation">
                            <Form.Label>Location</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter city or address"
                                value={newLocation}
                                onChange={(e) => setNewLocation(e.target.value)}
                                required
                                maxLength={150}
                             />
                             <Form.Control.Feedback type="invalid">Please provide a location.</Form.Control.Feedback>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="createSize">
                            <Form.Label>Size (m²)</Form.Label>
                            <Form.Control
                                type="number"
                                placeholder="Enter total square meters"
                                value={newSize_m2}
                                min="1"
                                step="any"
                                onChange={(e) => setNewSize_m2(e.target.value)}
                                required
                             />
                             <Form.Control.Feedback type="invalid">Please enter a valid size (positive number).</Form.Control.Feedback>
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                        <Button variant="primary" type="submit">Create Storehouse</Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" keyboard={false}>
            <Modal.Header closeButton>
                <Modal.Title>Edit Storehouse</Modal.Title>
            </Modal.Header>
            <Form noValidate onSubmit={(e) => { e.preventDefault(); handleUpdateStorehouse(); }}>
                <Modal.Body>
                    <Form.Group className="mb-3" controlId="editStorehouseName">
                        <Form.Label>Storehouse Name</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="Enter name"
                            value={editStorehouseName}
                            onChange={(e) => setEditStorehouseName(e.target.value)}
                            required
                            maxLength={100}
                        />
                        <Form.Control.Feedback type="invalid">Please provide a name.</Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="editLocation">
                        <Form.Label>Location</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="Enter location"
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            required
                            maxLength={150}
                        />
                        <Form.Control.Feedback type="invalid">Please provide a location.</Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="editSize_m2">
                        <Form.Label>Size (m²)</Form.Label>
                        <Form.Control
                            type="number"
                            placeholder="Enter size"
                            value={editSize_m2}
                            onChange={(e) => setEditSize_m2(e.target.value)}
                            min={1}
                            required
                        />
                        <Form.Control.Feedback type="invalid">Please enter a valid size.</Form.Control.Feedback>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseEditModal}>
                        Cancel
                    </Button>
                    <Button variant="warning" type="submit">
                        Update
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    </div>
);
}

export default MyStorehouses;