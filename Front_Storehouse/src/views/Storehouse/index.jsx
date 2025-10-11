import React, { useState, useEffect } from 'react';
import { Form, Button, Modal, Alert, Table, Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { PencilSquare, Trash, BoxSeam, PeopleFill, PlusLg } from 'react-bootstrap-icons';
import apiClient from '../../appService'; // REFACTORED: Import the centralized apiClient

// Note: The direct import for 'axios' has been removed.

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken', // Included for consistency, though not used directly here
    USER_ID: 'userId',
    USER_ROLE: 'userRole', // Included for consistency, though not used directly here
    USER_NAME: 'userName', // Included for consistency, though not used directly here
};


function MyStorehouses() {
    // --- All state hooks remain the same ---
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
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [storehouseToDelete, setStorehouseToDelete] = useState(null);

    const navigate = useNavigate();

    useEffect(() => {
        let isMounted = true;
        const fetchStorehouses = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
                if (!token) {
                    setError('No token found. Please log in.');
                    setLoading(false);
                    return;
                }
                const config = { headers: { Authorization: `Bearer ${token}` } };

                // REFACTORED: Use apiClient with a relative URL
                const response = await apiClient.get('/Companies/my-storehouses', config);

                if (isMounted) {
                    if (Array.isArray(response.data)) {
                        setStorehouses(response.data);
                    } else {
                        console.error("API did not return an array:", response.data);
                        setStorehouses([]);
                        setError("Failed to load storehouses: API returned unexpected data.");
                    }
                }
            } catch (err) {
                if (isMounted) {
                    console.error("Error fetching storehouses:", err);
                    let errorMessage = 'An unexpected error occurred.';
                    if (err.response) {
                        errorMessage = `Error: ${err.response.status} - ${err.response.data?.message || err.response.data || 'Server error'}`;
                        if (err.response.status === 401 || err.response.status === 403) {
                             errorMessage = 'Authentication error. Please log in again.';
                        }
                    } else if (err.request) {
                        errorMessage = 'Could not connect to the server. Please check your network.';
                    } else {
                        errorMessage = err.message;
                    }
                    setError(errorMessage);
                    setStorehouses([]);
                }
            } finally {
                if(isMounted) setLoading(false);
            }
        };
        fetchStorehouses();
        return () => { isMounted = false; };
    }, [navigate]);

    const handleCreateStorehouse = async () => {
        const size = Number(newSize_m2);
        if (!newStorehouseName || !newLocation || !newSize_m2 || isNaN(size) || size <= 0) {
            toast.warn('Please fill all fields with valid data.');
            return;
        }

        try {
            const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
            if (!token) {
                toast.error('No token found. Please log in.');
                return;
            }
            const config = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
            const newStorehouseData = { storehouseName: newStorehouseName, location: newLocation, size_m2: size };

            // REFACTORED: Use apiClient with a relative URL
            const response = await apiClient.post('/Storehouses', newStorehouseData, config);

            if (response.data && response.data.storehouseId) {
                toast.success('Storehouse created successfully!');
                setStorehouses(currentStorehouses => [...currentStorehouses, response.data]);
                handleCloseModal();
            } else {
                toast.success('Storehouse created! Refresh may be needed.');
                handleCloseModal();
            }
        } catch (err) {
            console.error("Create Storehouse Error:", err);
            let errorMessage = 'Error creating Storehouse.';
            if (err.response) {
                errorMessage = err.response.data?.message || err.response.data?.title || `Server Error: ${err.response.status}`;
            } else if (err.request) {
                errorMessage = 'Could not connect to the server.';
            } else {
                errorMessage = err.message;
            }
            toast.error(errorMessage);
        }
    };

    const handleDeleteStorehouse = async (id) => {
        if (!id) return;
        setDeletingId(id);
        try {
            const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
            if (!token) {
                toast.error('Authentication error. Please log in again.');
                setDeletingId(null);
                return;
            }
            const config = { headers: { Authorization: `Bearer ${token}` } };
            
            // REFACTORED: Use apiClient with a relative URL
            await apiClient.delete(`/Storehouses/${id}`, config);

            toast.success('Storehouse deleted successfully!');
            setStorehouses(currentStorehouses => currentStorehouses.filter(sh => sh.storehouseId !== id));

        } catch (err) {
            console.error('Delete Error:', err);
            let errorMessage = 'Error deleting storehouse.';
            if (err.response) {
                errorMessage = `Error: ${err.response.status} - ${err.response.data?.message || 'Server error'}`;
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

    const handleUpdateStorehouse = async () => {
        if (!editingId) {
            toast.error('Cannot update: Storehouse ID is missing.');
            return;
        }
        const size = Number(editSize_m2);
        if (!editStorehouseName || !editLocation || !editSize_m2 || isNaN(size) || size <= 0) {
            toast.warn('Please fill all fields with valid data.');
            return;
        }

        try {
            const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
            if (!token) {
                toast.error('Authentication error. Please log in again.');
                return;
            }
            const config = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
            const updateDto = { storehouseName: editStorehouseName, location: editLocation, size_m2: size };

            // REFACTORED: Use apiClient with a relative URL
            await apiClient.put(`/Storehouses/${editingId}`, updateDto, config);

            toast.success('Storehouse updated successfully!');
            setStorehouses(currentStorehouses =>
                currentStorehouses.map(sh =>
                    sh.storehouseId === editingId ? { ...sh, ...updateDto } : sh
                )
            );
            handleCloseEditModal();
        } catch (err) {
            console.error('Update Error:', err);
            let errorMessage = 'Error updating storehouse.';
            if (err.response) {
                errorMessage = err.response.data?.message || `Server Error: ${err.response.status}`;
            } else if (err.request) {
                errorMessage = 'Could not connect to the server.';
            } else {
                errorMessage = err.message;
            }
            toast.error(errorMessage);
        }
    };
    
    // --- All other handler functions (open/close modals, navigate, etc.) remain the same ---
    const handleOpenModal = () => setShowModal(true);
    const handleCloseModal = () => {
        setShowModal(false);
        setNewStorehouseName('');
        setNewLocation('');
        setNewSize_m2('');
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
    const handleOpenDeleteModal = (storehouse) => {
        setStorehouseToDelete(storehouse);
        setShowDeleteModal(true);
    };
    const handleCloseDeleteModal = () => {
        setShowDeleteModal(false);
        setStorehouseToDelete(null);
    };
    const handleConfirmDelete = async () => {
        if (!storehouseToDelete) return;
        await handleDeleteStorehouse(storehouseToDelete.storehouseId);
        handleCloseDeleteModal();
    };
    const handleViewSections = (storehouseId) => {
         if (!storehouseId) return;
        navigate(`/app/sections?storehouseId=${storehouseId}`);
    };
    const handleSeeWorkers = (storehouseId) => {
         if (!storehouseId) return;
        navigate(`/app/storehouseworkers?storehouseId=${storehouseId}`);
    };

    // --- The entire return JSX remains exactly the same ---
    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: "80vh" }}>
                <Spinner animation="border" variant="primary" />
                <span className="ms-3">Loading storehouses...</span>
            </div>
        );
    }

    if (error) {
        return <div className="container mt-4"><Alert variant="danger">Error loading storehouses: {error}</Alert></div>;
    }

    return (
        <div className="container-fluid mt-4">
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />

            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">My Storehouses</h2>
                <Button variant="success" onClick={handleOpenModal}>
                     <PlusLg className="me-2" /> Create Storehouse
                </Button>
            </div>

            {storehouses.length === 0 && !loading ? (
                 <Alert variant="info" className="text-center py-4">
                    <h4>No Storehouses Found</h4>
                    <p className="mb-0">You currently have no storehouses. Click the 'Create Storehouse' button to add your first one.</p>
                 </Alert>
            ) : (
                <Table striped bordered hover responsive="lg" className="align-middle shadow-sm">
                    <thead style={{ backgroundColor: '#4F5D75', color: 'white' }}>
                        <tr>
                            <th>Storehouse Name</th>
                            <th>Location</th>
                            <th>Size (m²)</th>
                            <th className="text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {storehouses.map((storehouse) => (
                            <tr key={storehouse.storehouseId}>
                                <td className="fw-bold">{storehouse.storehouseName || 'N/A'}</td>
                                <td>{storehouse.location || 'N/A'}</td>
                                <td>{storehouse.size_m2 ? storehouse.size_m2.toLocaleString() : 'N/A'}</td>
                                <td className="text-center">
                                    <div className="d-flex justify-content-center gap-2 flex-wrap">
                                        <Button size="sm" variant="outline-primary" onClick={() => handleViewSections(storehouse.storehouseId)} title="View Sections">
                                            <BoxSeam /> <span className="d-none d-md-inline">Sections</span>
                                        </Button>
                                        <Button size="sm" variant="outline-secondary" onClick={() => handleSeeWorkers(storehouse.storehouseId)} title="See Assigned Workers">
                                            <PeopleFill /> <span className="d-none d-md-inline">Workers</span>
                                        </Button>
                                        <Button size="sm" variant="outline-warning" onClick={() => handleOpenEditModal(storehouse)} title="Edit Storehouse">
                                            <PencilSquare /> <span className="d-none d-md-inline">Edit</span>
                                        </Button>
                                        <Button size="sm" variant="outline-danger" onClick={() => handleOpenDeleteModal(storehouse)} disabled={deletingId === storehouse.storehouseId} title="Delete Storehouse">
                                            {deletingId === storehouse.storehouseId ? (
                                                <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Deleting...</>
                                            ) : (
                                                <><Trash /> <span className="d-none d-md-inline">Delete</span></>
                                            )}
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
            {/* All modals remain the same */}
            <Modal show={showModal} onHide={handleCloseModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton>
                    <Modal.Title>Create New Storehouse</Modal.Title>
                </Modal.Header>
                 <Form noValidate onSubmit={(e) => { e.preventDefault(); handleCreateStorehouse(); }}>
                    <Modal.Body>
                        <Form.Group className="mb-3" controlId="createStorehouseName">
                            <Form.Label>Storehouse Name</Form.Label>
                            <Form.Control type="text" placeholder="Enter name (e.g., Main Warehouse)" value={newStorehouseName} onChange={(e) => setNewStorehouseName(e.target.value)} required autoFocus maxLength={100} />
                             <Form.Control.Feedback type="invalid">Please provide a name.</Form.Control.Feedback>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="createLocation">
                            <Form.Label>Location</Form.Label>
                            <Form.Control type="text" placeholder="Enter city or address" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} required maxLength={150} />
                             <Form.Control.Feedback type="invalid">Please provide a location.</Form.Control.Feedback>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="createSize">
                            <Form.Label>Size (m²)</Form.Label>
                            <Form.Control type="number" placeholder="Enter total square meters" value={newSize_m2} min="1" step="any" onChange={(e) => setNewSize_m2(e.target.value)} required />
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
                        <Form.Group className="mb-3" controlId="editStorehouseName"><Form.Label>Storehouse Name</Form.Label><Form.Control type="text" placeholder="Enter name" value={editStorehouseName} onChange={(e) => setEditStorehouseName(e.target.value)} required maxLength={100} /><Form.Control.Feedback type="invalid">Please provide a name.</Form.Control.Feedback></Form.Group>
                        <Form.Group className="mb-3" controlId="editLocation"><Form.Label>Location</Form.Label><Form.Control type="text" placeholder="Enter location" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} required maxLength={150} /><Form.Control.Feedback type="invalid">Please provide a location.</Form.Control.Feedback></Form.Group>
                        <Form.Group className="mb-3" controlId="editSize_m2"><Form.Label>Size (m²)</Form.Label><Form.Control type="number" placeholder="Enter size" value={editSize_m2} onChange={(e) => setEditSize_m2(e.target.value)} min={1} required /><Form.Control.Feedback type="invalid">Please enter a valid size.</Form.Control.Feedback></Form.Group>
                    </Modal.Body>
                    <Modal.Footer><Button variant="secondary" onClick={handleCloseEditModal}>Cancel</Button><Button variant="warning" type="submit">Update</Button></Modal.Footer>
                </Form>
            </Modal>
            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton><Modal.Title>Confirm Delete</Modal.Title></Modal.Header>
                <Modal.Body>
                    <div className="text-center">
                        <div className="mb-3"><i className="fas fa-exclamation-triangle text-warning" style={{ fontSize: '3rem' }}></i></div>
                        <h5>Are you sure you want to delete this storehouse?</h5>
                        <p className="text-muted"><strong>Storehouse:</strong> {storehouseToDelete?.storehouseName}<br /><strong>Location:</strong> {storehouseToDelete?.location}<br /><strong>Size:</strong> {storehouseToDelete?.size_m2?.toLocaleString()} m²</p>
                        <p className="text-danger"><strong>Warning:</strong> This action cannot be undone. All related data including sections, products, and worker assignments will be permanently deleted.</p>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseDeleteModal}>Cancel</Button>
                    <Button variant="danger" onClick={handleConfirmDelete} disabled={deletingId === storehouseToDelete?.storehouseId}>
                        {deletingId === storehouseToDelete?.storehouseId ? (<><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />Deleting...</>) : ('Delete Storehouse')}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default MyStorehouses;