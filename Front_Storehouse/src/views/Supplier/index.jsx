import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils';
import { Form, Button, Modal, Table, Alert, Spinner } from 'react-bootstrap';
import { PlusLg, PencilSquare, Trash, TelephoneFill } from 'react-bootstrap-icons';
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
    const userrole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);

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
        <div className="container-fluid mt-4">
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Supplier Management</h2>
                {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                    <Button variant="success" onClick={handleOpenCreateModal}>
                        <PlusLg className="me-2" />
                        Create Supplier
                    </Button>
                )}
            </div>

            {error && suppliers.length > 0 && <Alert variant="warning">Warning: {error}</Alert>}

            {suppliers.length === 0 && !loading && !error && (
                <Alert variant="info" className="text-center">
                    <p className="mb-0">No suppliers found. Add one to get started!</p>
                </Alert>
            )}

            <div className="table-responsive shadow-sm">
                <Table className="table-hover align-middle">
                    <thead className="bg-light">
                        <tr>
                            <th className="fw-bold">Supplier Name</th>
                            <th className="fw-bold">Contact Info</th>
                            <th className="text-center fw-bold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {suppliers.map((supplier) => (
                            <tr key={supplier.supplierId}>
                                <td className="fw-bold">{supplier.name || 'N/A'}</td>
                                <td className="text-muted">
                                    <TelephoneFill className="me-2" />
                                    {supplier.contactInfo || 'No contact info'}
                                </td>
                                <td>
                                    <div className="d-flex justify-content-center gap-2">
                                        {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline-warning"
                                                    onClick={() => handleOpenEditModal(supplier)}
                                                    disabled={isDeleting && supplierToDelete?.supplierId === supplier.supplierId}
                                                    title="Edit Supplier"
                                                >
                                                    <PencilSquare className="me-1" />
                                                    <span className="d-none d-md-inline">Edit</span>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline-danger"
                                                    onClick={() => handleOpenDeleteModal(supplier)}
                                                    disabled={isDeleting && supplierToDelete?.supplierId === supplier.supplierId}
                                                    title="Delete Supplier"
                                                >
                                                    {isDeleting && supplierToDelete?.supplierId === supplier.supplierId ? (
                                                        <Spinner as="span" size="sm" animation="border" />
                                                    ) : (
                                                        <>
                                                            <Trash className="me-1" />
                                                            <span className="d-none d-md-inline">Delete</span>
                                                        </>
                                                    )}
                                                </Button>
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
                <Modal.Header closeButton>
                    <Modal.Title>Create New Supplier</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleCreateSubmit}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>Supplier Name</Form.Label>
                            <Form.Control 
                                type="text" 
                                placeholder="Enter name" 
                                name="name" 
                                value={newSupplier.name} 
                                onChange={handleCreateInputChange} 
                                required 
                                autoFocus 
                                maxLength={100}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Contact Info</Form.Label>
                            <Form.Control 
                                as="textarea" 
                                rows={3} 
                                placeholder="Enter contact details (phone, email, address, etc.)" 
                                name="contactInfo" 
                                value={newSupplier.contactInfo} 
                                onChange={handleCreateInputChange}
                                maxLength={500}
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseCreateModal}>Cancel</Button>
                        <Button variant="success" type="submit">
                            <PlusLg className="me-2" />
                            Create
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" keyboard={false} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Supplier</Modal.Title>
                </Modal.Header>
                {editingSupplier && (
                    <Form onSubmit={handleUpdateSubmit}>
                        <Modal.Body>
                            <Form.Group className="mb-3">
                                <Form.Label>Supplier Name</Form.Label>
                                <Form.Control 
                                    type="text" 
                                    placeholder="Enter name" 
                                    name="name" 
                                    value={editingSupplier.name} 
                                    onChange={handleEditInputChange} 
                                    required 
                                    autoFocus 
                                    maxLength={100}
                                />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Contact Info</Form.Label>
                                <Form.Control 
                                    as="textarea" 
                                    rows={3} 
                                    placeholder="Enter contact details" 
                                    name="contactInfo" 
                                    value={editingSupplier.contactInfo} 
                                    onChange={handleEditInputChange}
                                    maxLength={500}
                                />
                            </Form.Group>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={handleCloseEditModal}>Cancel</Button>
                            <Button variant="warning" type="submit">
                                <PencilSquare className="me-2" />
                                Update
                            </Button>
                        </Modal.Footer>
                    </Form>
                )}
            </Modal>

            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} backdrop="static" keyboard={false} centered>
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
                            <>
                                <Trash className="me-2" />
                                Delete
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default SupplierManagement;