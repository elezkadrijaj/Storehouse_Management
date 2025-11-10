import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Modal, Table, Alert, Spinner } from 'react-bootstrap';
import { PlusLg, PencilSquare, Trash, TelephoneFill } from 'react-bootstrap-icons';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import apiClient from '../../appService';

// REFACTORED: Removed TOKEN and other unnecessary keys.
const SESSION_STORAGE_KEYS = {
    USER_ROLE: 'userRole',
};

function SupplierManagement() {
    // All state hooks remain the same.
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newSupplier, setNewSupplier] = useState({ name: '', contactInfo: '' });
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const userrole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);

    // --- START OF FIX ---
    // REMOVED the outdated getAuthHeaders function.
    // --- END OF FIX ---

    const fetchSuppliers = useCallback(async (isMounted) => {
        setLoading(true);
        setError(null);
        try {
            // REFACTORED: Simplified API call. No config needed for auth.
            const response = await apiClient.get('/Suppliers');
            if (isMounted) {
                setSuppliers(Array.isArray(response.data) ? response.data : []);
            }
        } catch (err) {
            if (isMounted) {
                setError(err.response?.data?.message || 'Failed to load suppliers.');
            }
        } finally {
            if (isMounted) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        // UPDATED: The new authentication check.
        const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
        if (!userRole) {
            setError('You are not logged in. Please log in.');
            setLoading(false);
            return;
        }

        let isMounted = true;
        fetchSuppliers(isMounted);
        return () => { isMounted = false; };
    }, [fetchSuppliers]);

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!newSupplier.name.trim()) {
            toast.warn('Supplier name cannot be empty.');
            return;
        }

        const supplierToCreate = {
            name: newSupplier.name,
            contactInfo: newSupplier.contactInfo
        };

        try {
            // REFACTORED: Simplified API call.
            const response = await apiClient.post('/Suppliers', supplierToCreate);
            toast.success('Supplier created successfully!');
            setSuppliers(prev => [...prev, response.data]);
            handleCloseCreateModal();
        } catch (err) {
            toast.error(err.response?.data?.title || 'Error creating supplier.');
        }
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        if (!editingSupplier || !editingSupplier.name.trim()) {
            toast.warn('Supplier name cannot be empty.');
            return;
        }

        const supplierToUpdate = {
            supplierId: editingSupplier.supplierId,
            name: editingSupplier.name,
            contactInfo: editingSupplier.contactInfo
        };

        try {
            // REFACTORED: Simplified API call.
            await apiClient.put(`/Suppliers/${editingSupplier.supplierId}`, supplierToUpdate);
            toast.success('Supplier updated successfully!');
            setSuppliers(suppliers.map(sup => sup.supplierId === editingSupplier.supplierId ? supplierToUpdate : sup));
            handleCloseEditModal();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error updating supplier.');
        }
    };

    const confirmDeleteSupplier = async () => {
        if (!supplierToDelete) return;
        setIsDeleting(true);

        try {
            // REFACTORED: Simplified API call.
            await apiClient.delete(`/Suppliers/${supplierToDelete.supplierId}`);
            toast.success(`Supplier "${supplierToDelete.name}" deleted successfully!`);
            setSuppliers(suppliers.filter(sup => sup.supplierId !== supplierToDelete.supplierId));
            handleCloseDeleteModal();
        } catch (err) {
            toast.error(err.response?.data?.message || `Error deleting supplier.`);
            setIsDeleting(false); // Only set to false on error, as success closes modal
        }
    };

    // Other handlers that don't make API calls remain the same
    const handleOpenCreateModal = () => { setNewSupplier({ name: '', contactInfo: '' }); setShowCreateModal(true); };
    const handleCloseCreateModal = () => setShowCreateModal(false);
    const handleCreateInputChange = (e) => { const { name, value } = e.target; setNewSupplier(prev => ({ ...prev, [name]: value })); };
    const handleOpenEditModal = (supplier) => { setEditingSupplier({ ...supplier }); setShowEditModal(true); };
    const handleCloseEditModal = () => { setShowEditModal(false); setEditingSupplier(null); };
    const handleEditInputChange = (e) => { if (editingSupplier) { const { name, value } = e.target; setEditingSupplier(prev => ({ ...prev, [name]: value })); } };
    const handleOpenDeleteModal = (supplier) => { setSupplierToDelete(supplier); setShowDeleteModal(true); };
    const handleCloseDeleteModal = () => { setShowDeleteModal(false); setSupplierToDelete(null); setIsDeleting(false); };

    // --- The entire return JSX remains exactly the same ---
    if (loading) {
        return <div className="container mt-4 d-flex justify-content-center"><Spinner animation="border" /></div>;
    }
    if (error && suppliers.length === 0) {
        return <div className="container mt-4"><Alert variant="danger">Error: {error}</Alert></div>;
    }

    return (
        <div className="container-fluid mt-4">
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Supplier Management</h2>
                {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                    <Button variant="success" onClick={handleOpenCreateModal}><PlusLg className="me-2" />Create Supplier</Button>
                )}
            </div>

            {error && suppliers.length > 0 && <Alert variant="warning">Warning: {error}</Alert>}
            {suppliers.length === 0 && !loading && !error && (<Alert variant="info" className="text-center"><p className="mb-0">No suppliers found. Add one to get started!</p></Alert>)}

            <div className="table-responsive shadow-sm">
                <Table className="table-hover align-middle">
                    <thead className="bg-light">
                        <tr><th className="fw-bold">Supplier Name</th><th className="fw-bold">Contact Info</th><th className="text-center fw-bold">Actions</th></tr>
                    </thead>
                    <tbody>
                        {suppliers.map((supplier) => (
                            <tr key={supplier.supplierId}>
                                <td className="fw-bold">{supplier.name || 'N/A'}</td>
                                <td className="text-muted"><TelephoneFill className="me-2" />{supplier.contactInfo || 'No contact info'}</td>
                                <td>
                                    <div className="d-flex justify-content-center gap-2">
                                        {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                                            <>
                                                <Button size="sm" variant="outline-warning" onClick={() => handleOpenEditModal(supplier)} disabled={isDeleting && supplierToDelete?.supplierId === supplier.supplierId} title="Edit Supplier"><PencilSquare className="me-1" /><span className="d-none d-md-inline">Edit</span></Button>
                                                <Button size="sm" variant="outline-danger" onClick={() => handleOpenDeleteModal(supplier)} disabled={isDeleting && supplierToDelete?.supplierId === supplier.supplierId} title="Delete Supplier">{isDeleting && supplierToDelete?.supplierId === supplier.supplierId ? (<Spinner as="span" size="sm" animation="border" />) : (<><Trash className="me-1" /><span className="d-none d-md-inline">Delete</span></>)}</Button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </div>

            <Modal show={showCreateModal} onHide={handleCloseCreateModal} backdrop="static" keyboard={false} centered>
                <Modal.Header closeButton><Modal.Title>Create New Supplier</Modal.Title></Modal.Header>
                <Form onSubmit={handleCreateSubmit}>
                    <Modal.Body>
                        <Form.Group className="mb-3"><Form.Label>Supplier Name</Form.Label><Form.Control type="text" placeholder="Enter name" name="name" value={newSupplier.name} onChange={handleCreateInputChange} required autoFocus maxLength={100} /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Contact Info</Form.Label><Form.Control as="textarea" rows={3} placeholder="Enter contact details" name="contactInfo" value={newSupplier.contactInfo} onChange={handleCreateInputChange} maxLength={500} /></Form.Group>
                    </Modal.Body>
                    <Modal.Footer><Button variant="secondary" onClick={handleCloseCreateModal}>Cancel</Button><Button variant="success" type="submit"><PlusLg className="me-2" />Create</Button></Modal.Footer>
                </Form>
            </Modal>

            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" keyboard={false} centered>
                <Modal.Header closeButton><Modal.Title>Edit Supplier</Modal.Title></Modal.Header>
                {editingSupplier && (
                    <Form onSubmit={handleUpdateSubmit}>
                        <Modal.Body>
                            <Form.Group className="mb-3"><Form.Label>Supplier Name</Form.Label><Form.Control type="text" placeholder="Enter name" name="name" value={editingSupplier.name} onChange={handleEditInputChange} required autoFocus maxLength={100} /></Form.Group>
                            <Form.Group className="mb-3"><Form.Label>Contact Info</Form.Label><Form.Control as="textarea" rows={3} placeholder="Enter contact details" name="contactInfo" value={editingSupplier.contactInfo} onChange={handleEditInputChange} maxLength={500} /></Form.Group>
                        </Modal.Body>
                        <Modal.Footer><Button variant="secondary" onClick={handleCloseEditModal}>Cancel</Button><Button variant="warning" type="submit"><PencilSquare className="me-2" />Update</Button></Modal.Footer>
                    </Form>
                )}
            </Modal>

            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} backdrop="static" keyboard={false} centered>
                <Modal.Header closeButton><Modal.Title>Confirm Deletion</Modal.Title></Modal.Header>
                <Modal.Body>
                    {supplierToDelete && (<p>Are you sure you want to delete the supplier: <strong>{supplierToDelete.name}</strong>?</p>)}
                    <p className="text-danger">This action cannot be undone.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseDeleteModal} disabled={isDeleting}>Cancel</Button>
                    <Button variant="danger" onClick={confirmDeleteSupplier} disabled={isDeleting}>{isDeleting ? (<><Spinner as="span" animation="border" size="sm" /> Deleting...</>) : (<><Trash className="me-2" />Delete</>)}</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default SupplierManagement;