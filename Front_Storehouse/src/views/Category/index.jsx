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

function CategoryManagement() {
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

    const fetchCategories = useCallback(async (isMounted) => {
        setLoading(true);
        setError(null);
        const config = getAuthHeaders();

        if (!config && isMounted) {
            return;
        } else if (!config) {
            return;
        }


        try {
            const response = await axios.get(`${API_BASE_URL}/Categories`, config);
            if (isMounted) {
                if (Array.isArray(response.data)) {
                    setCategories(response.data);
                } else {
                    console.error("Categories API did not return an array:", response.data);
                    setCategories([]);
                    setError("Failed to load categories: API returned unexpected data.");
                }
            }
        } catch (err) {
            if (isMounted) {
                console.error("Error fetching categories:", err);

                if (err.response?.status === 401) {
                     setError('Authentication failed or session expired. Please log in again.');
                } else {
                    setError(err.response?.data?.message || err.response?.data || err.message || 'An unexpected error occurred while fetching categories.');
                }
                setCategories([]);
            }
        } finally {
            if (isMounted) {
                setLoading(false);
            }
        }
    }, [getAuthHeaders]);

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
        const config = getAuthHeaders();
        if (!config) return;

        const categoryToCreate = {
            categoryId: "",
            name: newCategoryName
        };

        console.log("Sending category object:", categoryToCreate);

        try {
            const response = await axios.post(`${API_BASE_URL}/Categories`, categoryToCreate, config);
            console.log("Category created response:", response.data);
            toast.success('Category created successfully!');

            setCategories([...categories, response.data]);
            handleCloseCreateModal();
        } catch (err) {
            console.error("Create Category Error:", err);
             if (err.response) {
                 console.error("Error response data:", err.response.data);
                 console.error("Error response status:", err.response.status);
             }
            toast.error(err.response?.data?.title || err.response?.data?.message || err.response?.data || err.message || 'Error creating category.');
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
        const config = getAuthHeaders();
        if (!config) return;

        const categoryToUpdate = {
            categoryId: editingCategory.categoryId,
            name: editingCategory.name
        };

        try {
            await axios.put(`${API_BASE_URL}/Categories/${editingCategory.categoryId}`, categoryToUpdate, config);
            toast.success('Category updated successfully!');
            setCategories(
                categories.map((cat) =>
                    cat.categoryId === editingCategory.categoryId ? { ...categoryToUpdate } : cat
                )
            );
            handleCloseEditModal();
        } catch (err) {
            console.error('Update Category Error:', err);
            toast.error(err.response?.data?.message || err.response?.data || err.message || 'Error updating category.');
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
        const config = getAuthHeaders();
        if (!config) {
            setIsDeleting(false);
            handleCloseDeleteModal();
            return;
        }

        const id = categoryToDelete.categoryId;

        try {
            await axios.delete(`${API_BASE_URL}/Categories/${id}`, config);
            toast.success(`Category "${categoryToDelete.name}" deleted successfully!`);
            setCategories(categories.filter((cat) => cat.categoryId !== id));
            handleCloseDeleteModal();
        } catch (err) {
            console.error('Delete Category Error:', err);
            toast.error(err.response?.data?.message || err.response?.data || err.message || `Error deleting category "${categoryToDelete.name}".`);
            setIsDeleting(false);
        } finally {
        }
    };

    if (loading) {
        return <div className="container mt-4 d-flex justify-content-center"><Spinner animation="border" /></div>;
    }

    if (error && categories.length === 0) {
        return <div className="container mt-4"><Alert variant="danger">Error: {error}</Alert></div>;
    }


    return (
        <div className="container mt-4">
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2>Category Management</h2>
                <Button variant="success" onClick={handleOpenCreateModal}>
                    <i className="bi bi-plus-lg me-1"></i> Create Category
                </Button>
            </div>

             {error && categories.length > 0 && <Alert variant="warning">Warning: {error}</Alert>}


            {categories.length === 0 && !loading && !error && <Alert variant="info">No categories found. Add one to get started!</Alert>}

            <Row xs={1} md={2} lg={3} xl={4} className="g-4">
                {categories.map((category) => (
                    <Col key={category.categoryId}>
                        <Card className="h-100 shadow-sm">
                            <Card.Body className="d-flex flex-column">
                                <Card.Title className="flex-grow-1 mb-3">{category.name || 'N/A'}</Card.Title>
                                <div className="mt-auto d-flex gap-2 justify-content-end">
                                    <Button
                                        size="sm"
                                        variant="outline-warning"
                                        onClick={() => handleOpenEditModal(category)}
                                        disabled={isDeleting && categoryToDelete?.categoryId === category.categoryId}
                                    >
                                        <i className="bi bi-pencil-fill"></i>
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline-danger"
                                        onClick={() => handleOpenDeleteModal(category)}
                                        disabled={isDeleting && categoryToDelete?.categoryId === category.categoryId}
                                    >

                                        {isDeleting && categoryToDelete?.categoryId === category.categoryId
                                            ? <Spinner as="span" size="sm" animation="border" />
                                            : <i className="bi bi-trash3-fill"></i>
                                        }
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Modal show={showCreateModal} onHide={handleCloseCreateModal} backdrop="static" centered>
                <Modal.Header closeButton><Modal.Title>Create New Category</Modal.Title></Modal.Header>
                <Form onSubmit={handleCreateSubmit}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>Category Name</Form.Label>
                            <Form.Control type="text" placeholder="Enter category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} required autoFocus />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseCreateModal}>Cancel</Button>
                        <Button variant="primary" type="submit">Create</Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" centered>
                <Modal.Header closeButton><Modal.Title>Edit Category</Modal.Title></Modal.Header>

                {editingCategory && (
                    <Form onSubmit={handleUpdateSubmit}>
                        <Modal.Body>
                            <Form.Group className="mb-3">
                                <Form.Label>Category Name</Form.Label>
                                <Form.Control type="text" placeholder="Enter category name" value={editingCategory.name} onChange={handleEditInputChange} required autoFocus />
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

                    {categoryToDelete && (
                        <p>Are you sure you want to delete the category: <strong>{categoryToDelete.name}</strong>?</p>
                    )}
                    <p className="text-danger">This action cannot be undone. Products associated with this category might be affected.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseDeleteModal} disabled={isDeleting}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDeleteCategory} disabled={isDeleting}>
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

export default CategoryManagement;