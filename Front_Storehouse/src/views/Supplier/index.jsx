import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils';
import { Form, Button, Modal, Card, Row, Col, Alert, Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE_URL = 'https://localhost:7204/api';


const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

function SupplierManagement() {
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

    const getAuthHeaders = useCallback(() => {

        const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

        if (!token) {
            toast.error('Authentication token not found. Please log in.');
            setError('Authentication required. Please log in.');
            setLoading(false);
            return null;
        }
        return {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
    }, []);

    const fetchSuppliers = useCallback(async (isMounted) => {
        setLoading(true);
        setError(null);
        const config = getAuthHeaders();
         if (!config && isMounted) {
             return;
        } else if (!config) {
            return;
        }

        try {
            const response = await axios.get(`${API_BASE_URL}/Suppliers`, config);
            if (isMounted) {
                 if (Array.isArray(response.data)) {
                    setSuppliers(response.data);
                } else {
                    console.error("Suppliers API did not return an array:", response.data);
                    setSuppliers([]);
                    setError("Failed to load suppliers: API returned unexpected data.");
                }
            }
        } catch (err) {
             if (isMounted) {
                console.error("Error fetching suppliers:", err);
                 if (err.response?.status === 401) {
                     setError('Authentication failed or session expired. Please log in again.');
                 } else {
                     setError(err.response?.data?.message || err.response?.data || err.message || 'An unexpected error occurred while fetching suppliers.');
                 }
                setSuppliers([]);
            }
        } finally {
            if (isMounted) {
                setLoading(false);
            }
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        let isMounted = true;
        fetchSuppliers(isMounted);
        return () => { isMounted = false; };
    }, [fetchSuppliers]);

    const handleOpenCreateModal = () => {
        setNewSupplier({ name: '', contactInfo: '' });
        setShowCreateModal(true);
    };
    const handleCloseCreateModal = () => setShowCreateModal(false);

    const handleCreateInputChange = (e) => {
        const { name, value } = e.target;
        setNewSupplier(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!newSupplier.name.trim()) {
            toast.warn('Supplier name cannot be empty.');
            return;
        }
        const config = getAuthHeaders();
        if (!config) return;

        const supplierToCreate = {
            supplierId: "",
            name: newSupplier.name,
            contactInfo: newSupplier.contactInfo
        };

        console.log("Sending supplier object:", supplierToCreate);

        try {
            const response = await axios.post(`${API_BASE_URL}/Suppliers`, supplierToCreate, config);
            console.log("Supplier created response:", response.data);
            toast.success('Supplier created successfully!');
            setSuppliers([...suppliers, response.data]);
            handleCloseCreateModal();
            setNewSupplier({ name: '', contactInfo: '' });
        } catch (err) {
            console.error("Create Supplier Error:", err);
            if (err.response) {
                 console.error("Error response data:", err.response.data);
            }
            toast.error(err.response?.data?.title || err.response?.data?.message || err.response?.data || err.message || 'Error creating supplier.');
        }
    };

    const handleOpenEditModal = (supplier) => {
        setEditingSupplier({ ...supplier });
        setShowEditModal(true);
    };
    const handleCloseEditModal = () => {
        setShowEditModal(false);
        setEditingSupplier(null);
    };

    const handleEditInputChange = (e) => {
        if (editingSupplier) {
            const { name, value } = e.target;
            setEditingSupplier(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        if (!editingSupplier || !editingSupplier.name.trim()) {
            toast.warn('Supplier name cannot be empty.');
            return;
        }
        const config = getAuthHeaders();
        if (!config) return;

        const supplierToUpdate = {
            supplierId: editingSupplier.supplierId,
            name: editingSupplier.name,
            contactInfo: editingSupplier.contactInfo
        };

        try {
            await axios.put(`${API_BASE_URL}/Suppliers/${editingSupplier.supplierId}`, supplierToUpdate, config);
            toast.success('Supplier updated successfully!');
            setSuppliers(
                suppliers.map((sup) =>
                    sup.supplierId === editingSupplier.supplierId ? { ...supplierToUpdate } : sup
                )
            );
            handleCloseEditModal();
        } catch (err) {
            console.error('Update Supplier Error:', err);
            toast.error(err.response?.data?.message || err.response?.data || err.message || 'Error updating supplier.');
        }
    };

    const handleOpenDeleteModal = (supplier) => {
        setSupplierToDelete(supplier);
        setShowDeleteModal(true);
    };

    const handleCloseDeleteModal = () => {
        setShowDeleteModal(false);
        setSupplierToDelete(null);
        setIsDeleting(false);
    };

    const confirmDeleteSupplier = async () => {
        if (!supplierToDelete) return;

        setIsDeleting(true);
        const config = getAuthHeaders();
        if (!config) {
            setIsDeleting(false);
            handleCloseDeleteModal();
            return;
        }

        const id = supplierToDelete.supplierId;

        try {
            await axios.delete(`${API_BASE_URL}/Suppliers/${id}`, config);
            toast.success(`Supplier "${supplierToDelete.name}" deleted successfully!`);
            setSuppliers(suppliers.filter((sup) => sup.supplierId !== id));
            handleCloseDeleteModal();
        } catch (err) {
            console.error('Delete Supplier Error:', err);
            toast.error(err.response?.data?.message || err.response?.data || err.message || `Error deleting supplier "${supplierToDelete.name}".`);
            setIsDeleting(false);
        }
    };

     if (loading) {
        return <div className="container mt-4 d-flex justify-content-center"><Spinner animation="border" /></div>;
    }
    if (error && suppliers.length === 0) {
        return <div className="container mt-4"><Alert variant="danger">Error: {error}</Alert></div>;
    }

    return (
        <div className="container mt-4">
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2>Supplier Management</h2>
                <Button variant="success" onClick={handleOpenCreateModal}>
                    <i className="bi bi-plus-lg me-1"></i> Create Supplier
                </Button>
            </div>

             {error && suppliers.length > 0 && <Alert variant="warning">Warning: {error}</Alert>}

            {suppliers.length === 0 && !loading && !error && <Alert variant="info">No suppliers found. Add one to get started!</Alert>}

            <Row xs={1} md={2} lg={3} className="g-4">
                {suppliers.map((supplier) => (
                    <Col key={supplier.supplierId}>
                        <Card className="h-100 shadow-sm">
                            <Card.Body className="d-flex flex-column">
                                <Card.Title>{supplier.name || 'N/A'}</Card.Title>
                                <Card.Text className="flex-grow-1 text-muted" style={{ whiteSpace: 'pre-wrap', fontSize: '0.9em' }}>
                                    <i className="bi bi-telephone-fill me-1"></i>
                                    {supplier.contactInfo || 'No contact info'}
                                </Card.Text>
                                <div className="mt-auto d-flex gap-2 justify-content-end">
                                    <Button
                                        size="sm"
                                        variant="outline-warning"
                                        onClick={() => handleOpenEditModal(supplier)}
                                        disabled={isDeleting && supplierToDelete?.supplierId === supplier.supplierId}
                                    >
                                        <i className="bi bi-pencil-fill"></i>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline-danger"
                                        onClick={() => handleOpenDeleteModal(supplier)}
                                        disabled={isDeleting && supplierToDelete?.supplierId === supplier.supplierId}
                                    >
                                        {isDeleting && supplierToDelete?.supplierId === supplier.supplierId ? (
                                            <Spinner as="span" size="sm" animation="border" />
                                        ) : (
                                            <i className="bi bi-trash3-fill"></i>
                                        )}
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Modal show={showCreateModal} onHide={handleCloseCreateModal} backdrop="static" centered>
                <Modal.Header closeButton><Modal.Title>Create New Supplier</Modal.Title></Modal.Header>
                <Form onSubmit={handleCreateSubmit}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>Supplier Name</Form.Label>
                            <Form.Control type="text" placeholder="Enter name" name="name" value={newSupplier.name} onChange={handleCreateInputChange} required autoFocus />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Contact Info</Form.Label>
                            <Form.Control as="textarea" rows={3} placeholder="Enter contact details (phone, email, address, etc.)" name="contactInfo" value={newSupplier.contactInfo} onChange={handleCreateInputChange} />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseCreateModal}>Cancel</Button>
                        <Button variant="primary" type="submit">Create</Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" centered>
                <Modal.Header closeButton><Modal.Title>Edit Supplier</Modal.Title></Modal.Header>
                {editingSupplier && (
                    <Form onSubmit={handleUpdateSubmit}>
                        <Modal.Body>
                            <Form.Group className="mb-3">
                                <Form.Label>Supplier Name</Form.Label>
                                <Form.Control type="text" placeholder="Enter name" name="name" value={editingSupplier.name} onChange={handleEditInputChange} required autoFocus />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Contact Info</Form.Label>
                                <Form.Control as="textarea" rows={3} placeholder="Enter contact details" name="contactInfo" value={editingSupplier.contactInfo} onChange={handleEditInputChange} />
                            </Form.Group>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={handleCloseEditModal}>Cancel</Button>
                            <Button variant="primary" type="submit">Update</Button>
                        </Modal.Footer>
                    </Form>
                )}
            </Modal>

            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} backdrop="static" centered>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {supplierToDelete && (
                        <p>Are you sure you want to delete the supplier: <strong>{supplierToDelete.name}</strong>?</p>
                    )}
                    <p className="text-danger">This action cannot be undone.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseDeleteModal} disabled={isDeleting}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDeleteSupplier} disabled={isDeleting}>
                        {isDeleting ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                                <span className="ms-1">Deleting...</span>
                            </>
                        ) : (
                            'Delete'
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default SupplierManagement;