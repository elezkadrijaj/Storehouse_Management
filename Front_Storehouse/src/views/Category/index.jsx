// src/components/CategoryManagement.js (adjust path as needed)
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils'; // Adjust path
import { Form, Button, Modal, Card, Row, Col, Alert, Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css'; // Make sure this is imported
import 'bootstrap-icons/font/bootstrap-icons.css'; // Import bootstrap icons if not already
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE_URL = 'https://localhost:7204/api'; // Adjust if needed

function CategoryManagement() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Create Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null); // Holds { categoryId: '...', name: '...' }

    // Delete Modal State & Loading State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null); // Holds { categoryId: '...', name: '...' }
    const [isDeleting, setIsDeleting] = useState(false); // Specific loading state for delete action

    // --- Auth Header Helper ---
    const getAuthHeaders = useCallback(() => {
        const token = cookieUtils.getCookie('token');
        if (!token) {
            toast.error('Authentication token not found. Please log in.');
            setError('Authentication required. Please log in.'); // Also set error state
            setLoading(false); // Stop main loading
            return null;
        }
        return {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
    }, []);

    // --- Fetch Categories ---
    const fetchCategories = useCallback(async (isMounted) => {
        setLoading(true);
        setError(null);
        const config = getAuthHeaders();
        // getAuthHeaders already handles the error state if token is missing
        if (!config && isMounted) {
            // setLoading(false); // Already handled in getAuthHeaders scenario
            return;
        } else if (!config) {
            return; // Not mounted or no config
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
                // Handle specific auth errors if possible (e.g., 401 Unauthorized)
                if (err.response?.status === 401) {
                     setError('Authentication failed or session expired. Please log in again.');
                     // Optionally redirect to login page here
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
    }, [getAuthHeaders]); // Dependency on getAuthHeaders

    useEffect(() => {
        let isMounted = true;
        fetchCategories(isMounted);
        return () => { isMounted = false; };
    }, [fetchCategories]); // Re-fetch if fetchCategories changes (e.g., on login/logout if token changes)

    // --- Create Handlers ---
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

        // Send the structure the backend expects (including a placeholder categoryId)
        const categoryToCreate = {
            categoryId: "", // Or null, depending on backend strictness
            name: newCategoryName
        };

        console.log("Sending category object:", categoryToCreate); // Debug log

        try {
            const response = await axios.post(`${API_BASE_URL}/Categories`, categoryToCreate, config);
            console.log("Category created response:", response.data); // Debug log
            toast.success('Category created successfully!');
            // Use the actual category object returned by the API
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

    // --- Edit Handlers ---
    const handleOpenEditModal = (category) => {
        setEditingCategory({ ...category }); // Create a copy to avoid direct state mutation
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

        // API expects the full category object for PUT
        const categoryToUpdate = {
            categoryId: editingCategory.categoryId,
            name: editingCategory.name
        };

        try {
            await axios.put(`${API_BASE_URL}/Categories/${editingCategory.categoryId}`, categoryToUpdate, config);
            toast.success('Category updated successfully!');
            setCategories(
                categories.map((cat) =>
                    cat.categoryId === editingCategory.categoryId ? { ...categoryToUpdate } : cat // Ensure using the updated object
                )
            );
            handleCloseEditModal();
        } catch (err) {
            console.error('Update Category Error:', err);
            toast.error(err.response?.data?.message || err.response?.data || err.message || 'Error updating category.');
        }
    };

    // --- Delete Handlers ---
    const handleOpenDeleteModal = (category) => {
        setCategoryToDelete(category); // Store the whole category object
        setShowDeleteModal(true);
    };

    const handleCloseDeleteModal = () => {
        setShowDeleteModal(false);
        setCategoryToDelete(null); // Clear the category to delete
        setIsDeleting(false); // Ensure loading state is reset if modal is closed prematurely
    };

    const confirmDeleteCategory = async () => {
        if (!categoryToDelete) return; // Should not happen, but safety check

        setIsDeleting(true); // Start loading
        const config = getAuthHeaders();
        if (!config) {
            setIsDeleting(false); // Stop loading if no auth
            handleCloseDeleteModal(); // Close modal as well
            return;
        }

        const id = categoryToDelete.categoryId;

        try {
            await axios.delete(`${API_BASE_URL}/Categories/${id}`, config);
            toast.success(`Category "${categoryToDelete.name}" deleted successfully!`);
            setCategories(categories.filter((cat) => cat.categoryId !== id));
            handleCloseDeleteModal(); // Close modal on success
        } catch (err) {
            console.error('Delete Category Error:', err);
            toast.error(err.response?.data?.message || err.response?.data || err.message || `Error deleting category "${categoryToDelete.name}".`);
            setIsDeleting(false); // Stop loading on error, keep modal open maybe? Or close it:
            // handleCloseDeleteModal(); // Optionally close modal even on error
        } finally {
             // This might run too early if handleCloseDeleteModal is called inside try/catch
             // It's safer to set isDeleting=false within the try/catch blocks or rely on handleCloseDeleteModal
             // setIsDeleting(false); // Moved into try/catch and handleCloseDeleteModal
        }
    };


    // --- Render Logic ---
    if (loading) {
        return <div className="container mt-4 d-flex justify-content-center"><Spinner animation="border" /></div>;
    }
    // Keep showing error prominently if initial fetch failed or auth issue
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

            {/* Show non-blocking fetch error if categories were previously loaded */}
             {error && categories.length > 0 && <Alert variant="warning">Warning: {error}</Alert>}


            {categories.length === 0 && !loading && !error && <Alert variant="info">No categories found. Add one to get started!</Alert>}

            <Row xs={1} md={2} lg={3} xl={4} className="g-4"> {/* Responsive Grid */}
                {categories.map((category) => (
                    <Col key={category.categoryId}>
                        <Card className="h-100 shadow-sm"> {/* Added shadow for depth */}
                            <Card.Body className="d-flex flex-column">
                                <Card.Title className="flex-grow-1 mb-3">{category.name || 'N/A'}</Card.Title> {/* Ensure some space */}
                                <div className="mt-auto d-flex gap-2 justify-content-end">
                                    <Button
                                        size="sm"
                                        variant="outline-warning"
                                        onClick={() => handleOpenEditModal(category)}
                                        disabled={isDeleting && categoryToDelete?.categoryId === category.categoryId} // Disable if this one is being deleted
                                    >
                                        <i className="bi bi-pencil-fill"></i> {/* Icon */}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline-danger"
                                        onClick={() => handleOpenDeleteModal(category)} // Use open modal handler
                                        disabled={isDeleting && categoryToDelete?.categoryId === category.categoryId} // Disable if this one is being deleted
                                    >
                                        {/* Show spinner only if *this* category is the one being processed for deletion */}
                                        {isDeleting && categoryToDelete?.categoryId === category.categoryId
                                            ? <Spinner as="span" size="sm" animation="border" />
                                            : <i className="bi bi-trash3-fill"></i> /* Icon */
                                        }
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Create Modal */}
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

            {/* Edit Modal */}
            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" centered>
                <Modal.Header closeButton><Modal.Title>Edit Category</Modal.Title></Modal.Header>
                {/* Render form only when editingCategory is available */}
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

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} backdrop="static" centered>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {/* Check if categoryToDelete exists before accessing its properties */}
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