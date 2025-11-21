import React, { useState, useEffect } from 'react';
import { Form, Button, Modal, Alert, Table, Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { PencilSquare, Trash, BoxSeam, PeopleFill, PlusLg } from 'react-bootstrap-icons';
import apiClient from '../../appService';

// REFACTORED: Removed TOKEN and other unnecessary keys.
const SESSION_STORAGE_KEYS = {
    USER_ROLE: 'userRole',
};

function MyStorehouses() {
    // All state hooks remain the same.
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
            
            // UPDATED: The new authentication check.
            const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
            if (!userRole) {
                if (isMounted) {
                    setError('You are not logged in. Please log in.');
                    setLoading(false);
                }
                return;
            }

            try {
                // REFACTORED: Simplified API call. No config needed for auth.
                const response = await apiClient.get('/Companies/my-storehouses');
                if (isMounted) {
                    setStorehouses(Array.isArray(response.data) ? response.data : []);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err.response?.data?.message || 'Failed to load storehouses.');
                }
            } finally {
                if(isMounted) setLoading(false);
            }
        };
        fetchStorehouses();
        return () => { isMounted = false; };
    }, []); // Removed navigate from dependency array as it's stable

    const handleCreateStorehouse = async () => {
        const size = Number(newSize_m2);
        if (!newStorehouseName || !newLocation || !newSize_m2 || isNaN(size) || size <= 0) {
            toast.warn('Please fill all fields with valid data.');
            return;
        }

        try {
            const newStorehouseData = { storehouseName: newStorehouseName, location: newLocation, size_m2: size };

            // REFACTORED: Simplified API call.
            const response = await apiClient.post('/Storehouses', newStorehouseData);
            toast.success('Storehouse created successfully!');
            setStorehouses(prev => [...prev, response.data]);
            handleCloseModal();
        } catch (err) {
            toast.error(err.response?.data?.title || 'Error creating storehouse.');
        }
    };

    const handleDeleteStorehouse = async (id) => {
        if (!id) return;
        setDeletingId(id);
        try {
            // REFACTORED: Simplified API call.
            await apiClient.delete(`/Storehouses/${id}`);
            toast.success('Storehouse deleted successfully!');
            setStorehouses(prev => prev.filter(sh => sh.storehouseId !== id));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error deleting storehouse.');
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
            const updateDto = { storehouseName: editStorehouseName, location: editLocation, size_m2: size };

            // REFACTORED: Simplified API call.
            await apiClient.put(`/Storehouses/${editingId}`, updateDto);
            toast.success('Storehouse updated successfully!');
            setStorehouses(prev => prev.map(sh => sh.storehouseId === editingId ? { ...sh, ...updateDto } : sh));
            handleCloseEditModal();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error updating storehouse.');
        }
    };
    
    // All other handler functions (open/close modals, navigate, etc.) remain the same
    const handleOpenModal = () => setShowModal(true);
    const handleCloseModal = () => { setShowModal(false); setNewStorehouseName(''); setNewLocation(''); setNewSize_m2(''); };
    const handleOpenEditModal = (storehouse) => { setEditingId(storehouse.storehouseId); setEditStorehouseName(storehouse.storehouseName || ''); setEditLocation(storehouse.location || ''); setEditSize_m2(storehouse.size_m2?.toString() || ''); setShowEditModal(true); };
    const handleCloseEditModal = () => { setShowEditModal(false); setEditingId(null); setEditStorehouseName(''); setEditLocation(''); setEditSize_m2(''); };
    const handleOpenDeleteModal = (storehouse) => { setStorehouseToDelete(storehouse); setShowDeleteModal(true); };
    const handleCloseDeleteModal = () => { setShowDeleteModal(false); setStorehouseToDelete(null); };
    const handleConfirmDelete = async () => { if (!storehouseToDelete) return; await handleDeleteStorehouse(storehouseToDelete.storehouseId); handleCloseDeleteModal(); };
    const handleViewSections = (storehouseId) => { if (storehouseId) navigate(`/app/sections?storehouseId=${storehouseId}`); };
    const handleSeeWorkers = (storehouseId) => { if (storehouseId) navigate(`/app/storehouseworkers?storehouseId=${storehouseId}`); };

    // The entire return JSX remains exactly the same.
    if (loading) {
        return <div className="d-flex justify-content-center align-items-center" style={{ height: "80vh" }}><Spinner animation="border" variant="primary" /><span className="ms-3">Loading storehouses...</span></div>;
    }
    if (error) {
        return <div className="container mt-4"><Alert variant="danger">Error loading storehouses: {error}</Alert></div>;
    }
    return (
        <div className="container-fluid mt-4">
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">My Storehouses</h2>
                <Button variant="success" onClick={handleOpenModal}><PlusLg className="me-2" /> Create Storehouse</Button>
            </div>
            {storehouses.length === 0 && !loading ? (
                 <Alert variant="info" className="text-center py-4"><h4>No Storehouses Found</h4><p className="mb-0">Click 'Create Storehouse' to add your first one.</p></Alert>
            ) : (
                <Table striped bordered hover responsive="lg" className="align-middle shadow-sm">
                    <thead style={{ backgroundColor: '#4F5D75', color: 'white' }}>
                        <tr><th>Storehouse Name</th><th>Location</th><th>Size (m²)</th><th className="text-center">Actions</th></tr>
                    </thead>
                    <tbody>
                        {storehouses.map((storehouse) => (
                            <tr key={storehouse.storehouseId}>
                                <td className="fw-bold">{storehouse.storehouseName || 'N/A'}</td>
                                <td>{storehouse.location || 'N/A'}</td>
                                <td>{storehouse.size_m2 ? storehouse.size_m2.toLocaleString() : 'N/A'}</td>
                                <td className="text-center">
                                    <div className="d-flex justify-content-center gap-2 flex-wrap">
                                        <Button size="sm" variant="outline-primary" onClick={() => handleViewSections(storehouse.storehouseId)} title="View Sections"><BoxSeam /> <span className="d-none d-md-inline">Sections</span></Button>
                                        <Button size="sm" variant="outline-secondary" onClick={() => handleSeeWorkers(storehouse.storehouseId)} title="See Assigned Workers"><PeopleFill /> <span className="d-none d-md-inline">Workers</span></Button>
                                        <Button size="sm" variant="outline-warning" onClick={() => handleOpenEditModal(storehouse)} title="Edit Storehouse"><PencilSquare /> <span className="d-none d-md-inline">Edit</span></Button>
                                        <Button size="sm" variant="outline-danger" onClick={() => handleOpenDeleteModal(storehouse)} disabled={deletingId === storehouse.storehouseId} title="Delete Storehouse">{deletingId === storehouse.storehouseId ? <><Spinner as="span" animation="border" size="sm" /> Deleting...</> : <><Trash /> <span className="d-none d-md-inline">Delete</span></>}</Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
            <Modal show={showModal} onHide={handleCloseModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton><Modal.Title>Create New Storehouse</Modal.Title></Modal.Header>
                 <Form noValidate onSubmit={(e) => { e.preventDefault(); handleCreateStorehouse(); }}>
                    <Modal.Body>
                        <Form.Group className="mb-3"><Form.Label>Storehouse Name</Form.Label><Form.Control type="text" placeholder="e.g., Main Warehouse" value={newStorehouseName} onChange={(e) => setNewStorehouseName(e.target.value)} required autoFocus maxLength={100} /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Location</Form.Label><Form.Control type="text" placeholder="e.g., City or Address" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} required maxLength={150} /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Size (m²)</Form.Label><Form.Control type="number" placeholder="e.g., 500" value={newSize_m2} min="1" step="any" onChange={(e) => setNewSize_m2(e.target.value)} required /></Form.Group>
                    </Modal.Body>
                    <Modal.Footer><Button variant="secondary" onClick={handleCloseModal}>Cancel</Button><Button variant="primary" type="submit">Create Storehouse</Button></Modal.Footer>
                </Form>
            </Modal>
            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton><Modal.Title>Edit Storehouse</Modal.Title></Modal.Header>
                <Form noValidate onSubmit={(e) => { e.preventDefault(); handleUpdateStorehouse(); }}>
                    <Modal.Body>
                        <Form.Group className="mb-3"><Form.Label>Storehouse Name</Form.Label><Form.Control type="text" value={editStorehouseName} onChange={(e) => setEditStorehouseName(e.target.value)} required maxLength={100} /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Location</Form.Label><Form.Control type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} required maxLength={150} /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Size (m²)</Form.Label><Form.Control type="number" value={editSize_m2} onChange={(e) => setEditSize_m2(e.target.value)} min={1} required /></Form.Group>
                    </Modal.Body>
                    <Modal.Footer><Button variant="secondary" onClick={handleCloseEditModal}>Cancel</Button><Button variant="warning" type="submit">Update</Button></Modal.Footer>
                </Form>
            </Modal>
            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton><Modal.Title>Confirm Delete</Modal.Title></Modal.Header>
                <Modal.Body>
                    <div className="text-center">
                        <p>Are you sure you want to delete this storehouse?</p>
                        <p className="text-muted"><strong>{storehouseToDelete?.storehouseName}</strong></p>
                        <p className="text-danger"><strong>Warning:</strong> This cannot be undone.</p>
                    </div>
                </Modal.Body>
                <Modal.Footer><Button variant="secondary" onClick={handleCloseDeleteModal}>Cancel</Button><Button variant="danger" onClick={handleConfirmDelete} disabled={deletingId === storehouseToDelete?.storehouseId}>{deletingId === storehouseToDelete?.storehouseId ? <><Spinner as="span" animation="border" size="sm" /> Deleting...</> : 'Delete Storehouse'}</Button></Modal.Footer>
            </Modal>
        </div>
    );
}

export default MyStorehouses;