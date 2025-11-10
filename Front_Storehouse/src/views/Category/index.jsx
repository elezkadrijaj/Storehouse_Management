import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Modal, Table, Alert, Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { PlusLg, PencilSquare, Trash } from 'react-bootstrap-icons';
import apiClient from '../../appService';

// NOTE: The cookieUtils import and API_BASE_URL constant have been removed.

const SESSION_STORAGE_KEYS = {
    // REMOVED: TOKEN and other auth-related keys are no longer needed here.
    USER_ROLE: 'userRole',
};

function CategoryManagement() {
    // All state hooks remain the same
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const userrole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);

    // --- START OF FIX ---
    // REMOVED the outdated getAuthHeaders function.
    // --- END OF FIX ---

    const fetchCategories = useCallback(async (isMounted) => {
        setLoading(true);
        setError(null);
        try {
            // REFACTORED: Simplified API call. No config needed for auth.
            const response = await apiClient.get('/Categories');
            if (isMounted) {
                if (Array.isArray(response.data)) {
                    setCategories(response.data);
                } else {
                    setError("API returned unexpected data for categories.");
                }
            }
        } catch (err) {
            if (isMounted) {
                setError(err.response?.data?.message || 'Failed to fetch categories.');
            }
        } finally {
            if (isMounted) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        fetchCategories(isMounted);
        return () => { isMounted = false; };
    }, [fetchCategories]);

    const handleOpenCreateModal = () => {
        setNewCategoryName('');
        setShowCreateModal(true);
    };
    const handleCloseCreateModal = () => setShowCreateModal(false);

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) {
            toast.warn('Category name cannot be empty.');
            return;
        }
        
        const categoryToCreate = { name: newCategoryName };

        try {
            // REFACTORED: Simplified API call.
            const response = await apiClient.post('/Categories', categoryToCreate);
            toast.success('Category created successfully!');
            setCategories(prev => [...prev, response.data]);
            handleCloseCreateModal();
        } catch (err) {
            toast.error(err.response?.data?.title || 'Error creating category.');
        }
    };

    const handleOpenEditModal = (category) => {
        setEditingCategory({ ...category });
        setShowEditModal(true);
    };
    const handleCloseEditModal = () => {
        setShowEditModal(false);
        setEditingCategory(null);
    };
    const handleEditInputChange = (e) => {
        if (editingCategory) {
            setEditingCategory({ ...editingCategory, name: e.target.value });
        }
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        if (!editingCategory || !editingCategory.name.trim()) {
            toast.warn('Category name cannot be empty.');
            return;
        }
        
        const categoryToUpdate = {
            categoryId: editingCategory.categoryId,
            name: editingCategory.name
        };

        try {
            // REFACTORED: Simplified API call.
            await apiClient.put(`/Categories/${editingCategory.categoryId}`, categoryToUpdate);
            toast.success('Category updated successfully!');
            setCategories(cats => cats.map(cat => (cat.categoryId === editingCategory.categoryId ? categoryToUpdate : cat)));
            handleCloseEditModal();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error updating category.');
        }
    };

    const handleOpenDeleteModal = (category) => {
        setCategoryToDelete(category);
        setShowDeleteModal(true);
    };
    const handleCloseDeleteModal = () => {
        setShowDeleteModal(false);
        setCategoryToDelete(null);
        setIsDeleting(false);
    };

    const confirmDeleteCategory = async () => {
        if (!categoryToDelete) return;
        setIsDeleting(true);

        try {
            // REFACTORED: Simplified API call.
            await apiClient.delete(`/Categories/${categoryToDelete.categoryId}`);
            toast.success(`Category "${categoryToDelete.name}" deleted successfully!`);
            setCategories(cats => cats.filter(cat => cat.categoryId !== categoryToDelete.categoryId));
            handleCloseDeleteModal();
        } catch (err) {
            toast.error(err.response?.data?.message || `Error deleting category.`);
            setIsDeleting(false);
        }
    };

    // --- The entire return JSX remains exactly the same ---
    if (loading) {
        return <div className="container mt-4 d-flex justify-content-center"><Spinner animation="border" /></div>;
    }
    if (error && categories.length === 0) {
        return <div className="container mt-4"><Alert variant="danger">Error: {error}</Alert></div>;
    }
    return (
        <div className="container-fluid mt-4">
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
            
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Category Management</h2>
                {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                    <Button variant="success" onClick={handleOpenCreateModal}><PlusLg className="me-2" /> Create Category</Button>
                )}
            </div>

            {error && categories.length > 0 && <Alert variant="warning">Warning: {error}</Alert>}
            {!loading && categories.length === 0 && !error && (
                <Alert variant="info" className="text-center py-4"><h4>No Categories Found</h4><p className="mb-0">Click 'Create Category' to add your first one.</p></Alert>
            )}

            {!loading && categories.length > 0 && (
                <Table striped bordered hover responsive="lg" className="align-middle shadow-sm">
                    <thead style={{ backgroundColor: '#4F5D75', color: 'white' }}>
                        <tr><th>Category Name</th><th className="text-center">Actions</th></tr>
                    </thead>
                    <tbody>
                        {categories.map((category) => (
                            <tr key={category.categoryId}>
                                <td className="fw-bold">{category.name || 'N/A'}</td>
                                <td className="text-center">
                                    {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                                        <div className="d-flex justify-content-center gap-2 flex-wrap">
                                            <Button size="sm" variant="outline-warning" onClick={() => handleOpenEditModal(category)} title="Edit Category"><PencilSquare /> <span className="d-none d-md-inline">Edit</span></Button>
                                            <Button size="sm" variant="outline-danger" onClick={() => handleOpenDeleteModal(category)} title="Delete Category"><Trash /> <span className="d-none d-md-inline">Delete</span></Button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}

            <Modal show={showCreateModal} onHide={handleCloseCreateModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton><Modal.Title>Create New Category</Modal.Title></Modal.Header>
                <Form noValidate onSubmit={handleCreateSubmit}>
                    <Modal.Body><Form.Group className="mb-3"><Form.Label>Category Name</Form.Label><Form.Control type="text" placeholder="Enter category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} required autoFocus maxLength={100} /><Form.Control.Feedback type="invalid">Please provide a name.</Form.Control.Feedback></Form.Group></Modal.Body>
                    <Modal.Footer><Button variant="secondary" onClick={handleCloseCreateModal}>Cancel</Button><Button variant="success" type="submit"><PlusLg className="me-2" /> Create Category</Button></Modal.Footer>
                </Form>
            </Modal>

            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton><Modal.Title>Edit Category</Modal.Title></Modal.Header>
                {editingCategory && (
                    <Form noValidate onSubmit={handleUpdateSubmit}>
                        <Modal.Body><Form.Group className="mb-3"><Form.Label>Category Name</Form.Label><Form.Control type="text" placeholder="Enter category name" value={editingCategory.name} onChange={handleEditInputChange} required autoFocus maxLength={100} /><Form.Control.Feedback type="invalid">Please provide a name.</Form.Control.Feedback></Form.Group></Modal.Body>
                        <Modal.Footer><Button variant="secondary" onClick={handleCloseEditModal}>Cancel</Button><Button variant="warning" type="submit"><PencilSquare className="me-2" /> Update Category</Button></Modal.Footer>
                    </Form>
                )}
            </Modal>

            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} backdrop="static" keyboard={false} centered>
                <Modal.Header closeButton><Modal.Title>Confirm Deletion</Modal.Title></Modal.Header>
                <Modal.Body>
                    {categoryToDelete && (<p>Are you sure you want to delete the category: <strong>{categoryToDelete.name}</strong>?</p>)}
                    <p className="text-danger">This action cannot be undone. Products in this category may be affected.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseDeleteModal} disabled={isDeleting}>Cancel</Button>
                    <Button variant="danger" onClick={confirmDeleteCategory} disabled={isDeleting}>{isDeleting ? (<><Spinner as="span" animation="border" size="sm" /> Deleting...</>) : (<><Trash className="me-2" /> Delete Category</>)}</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default CategoryManagement;