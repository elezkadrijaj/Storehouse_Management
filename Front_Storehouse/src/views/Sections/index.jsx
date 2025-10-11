import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Table, Button, Modal, Form, Spinner, Alert } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { PencilSquare, Trash, BoxSeam, PlusLg } from 'react-bootstrap-icons';
import apiClient from '../../appService';

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken', // Included for consistency, though not used directly here
    USER_ID: 'userId',
    USER_ROLE: 'userRole', // Included for consistency, though not used directly here
    USER_NAME: 'userName', // Included for consistency, though not used directly here
};


function Sections() {
    const [searchParams] = useSearchParams();
    const storehouseId = searchParams.get('storehouseId');
    const navigate = useNavigate();

    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [storehouseName, setStorehouseName] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [newSectionName, setNewSectionName] = useState('');

    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedSection, setSelectedSection] = useState(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [sectionToDelete, setSectionToDelete] = useState(null);

    // Get the user role when the component renders
    const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
    // Determine if the user has the required role (case-insensitive check is safer)
    const lowerCaseRole = userRole?.toLowerCase();
    const canModifySections = userRole?.toLowerCase() === 'companymanager' || userRole?.toLowerCase() === 'storehousemanager';

    const handleViewSectionProducts = (sectionId) => {
        if (!sectionId) {
            console.error("Cannot navigate: Section ID is missing.");
            toast.warn("Cannot view products for this section (missing ID).");
            return;
        }
        // Navigate to the Product Management page with both storehouseId and sectionId
        navigate(`/app/product?storehouseId=${storehouseId}&sectionId=${sectionId}`);
    };

    useEffect(() => {
        if (storehouseId) { // Checks if storehouseId was found in the URL
            fetchSections();
        } else {
            setLoading(false);
        }
    }, [storehouseId]);

    const fetchSections = async () => {
        setLoading(true);
        setError(null);
        // Reset state before fetching
        setSections([]);
        setStorehouseName('');
        try {
            const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

            if (!token) {
                setError('No token found. Please log in.');
                setLoading(false);
                return;
            }

            const config = { headers: { Authorization: `Bearer ${token}` } };

            // Use Promise.all to fetch concurrently (optional optimization)
            const [storehouseRes, sectionsRes] = await Promise.all([
                apiClient.get(`/Storehouses/${storehouseId}`, config),
                apiClient.get(`/Storehouses/${storehouseId}/Sections`, config)
            ]);

            setStorehouseName(storehouseRes.data.storehouseName); // Assuming API returns storehouseName
            setSections(sectionsRes.data);

        } catch (err) {
            console.error('Error fetching data:', err);
            // Check for specific error types if needed (e.g., 404)
            if (err.response && err.response.status === 404) {
                setError(`Storehouse or Sections not found for ID: ${storehouseId}`);
            } else {
                setError(err.message || 'Failed to load data.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = () => setShowModal(true);
    const handleCloseModal = () => {
        setShowModal(false);
        setNewSectionName('');
    };

    const handleCreateSection = async () => {
        try {
            const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
            if (!token) {
                toast.error('No token found. Please log in.');
                return;
            }
            if (!newSectionName.trim()) {
                toast.warn('Section name cannot be empty.');
                return;
            }

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            };

            const newSection = {
                name: newSectionName,
                storehousesId: parseInt(storehouseId, 10), // Ensure storehouseId is an integer
            };

            const response = await apiClient.post('/Sections', newSection, config);
            toast.success('Section created successfully!');

            // Add the new section directly to state for faster UI update
            setSections([...sections, response.data]); // Assuming API returns the created section

            // fetchSections(); // Optionally refetch all if direct state update is complex
            handleCloseModal();
        } catch (err) {
            console.error('Error creating section:', err);
            toast.error(err.response?.data?.message || err.response?.data || 'Error creating section.');
        }
    };

    const handleShowEditModal = (section) => {
        setSelectedSection(section);
        setNewSectionName(section.name);
        setShowEditModal(true);
    };

    const handleCloseEditModal = () => {
        setShowEditModal(false);
        setSelectedSection(null);
        setNewSectionName('');
    };

    const handleEditSection = async () => {
        if (!selectedSection) return;

        try {
            const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

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

            const updatedSection = {
                ...selectedSection,
                name: newSectionName,  // Update section name
            };

            await apiClient.put(
                `https://localhost:7204/api/Sections/${selectedSection.sectionId}`,
                updatedSection,
                config
            );
            toast.success('Section updated successfully!');

            // Refresh the sections list
            setSections(sections.map((section) =>
                section.sectionId === selectedSection.sectionId ? updatedSection : section
            ));

            handleCloseEditModal();
        } catch (err) {
            console.error('Error updating section:', err);
            toast.error(err.response?.data?.message || 'Error updating section.');
        }
    };

    const handleShowDeleteModal = (section) => {
        setSectionToDelete(section);
        setShowDeleteModal(true);
    };

    const handleCloseDeleteModal = () => {
        setShowDeleteModal(false);
        setSectionToDelete(null);
    };

    const handleDeleteSection = async () => {
        if (!sectionToDelete) return;

        try {
            const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
            if (!token) {
                toast.error('No token found. Please log in.');
                return;
            }

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            };

            await apiClient.delete(
                `https://localhost:7204/api/Sections/${sectionToDelete.sectionId}`,
                config
            );
            toast.success('Section deleted successfully!');

            // Refresh sections list after deletion by filtering state
            setSections(sections.filter((section) => section.sectionId !== sectionToDelete.sectionId));

            handleCloseDeleteModal();
        } catch (err) {
            console.error('Error deleting section:', err);
            toast.error(err.response?.data?.message || err.response?.data || 'Error deleting section.');
        }
    };

    return (
        <div className="container-fluid mt-4">
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />

            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Sections for Storehouse: {storehouseName || (loading ? "Loading..." : "N/A")}</h2>
                {canModifySections && !loading && (
                    <Button variant="success" onClick={handleOpenModal}>
                        <PlusLg className="me-2" /> Create Section
                    </Button>
                )}
            </div>

            {error && <Alert variant="danger">{error}</Alert>}

            {loading && (
                <div className="d-flex justify-content-center align-items-center" style={{ height: "80vh" }}>
                    <Spinner animation="border" variant="primary" />
                    <span className="ms-3">Loading sections...</span>
                </div>
            )}

            {!loading && sections.length === 0 && !error && (
                <Alert variant="info" className="text-center py-4">
                    <h4>No Sections Found</h4>
                    <p className="mb-0">This storehouse has no sections yet. Click the 'Create Section' button to add your first one.</p>
                </Alert>
            )}

            {!loading && sections.length > 0 && (
                <Table striped bordered hover responsive="lg" className="align-middle shadow-sm">
                    <thead style={{ backgroundColor: '#4F5D75', color: 'white' }}>
                        <tr>
                            <th>Section Name</th>
                            <th className="text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sections.map((section) => (
                            <tr key={section.sectionId}>
                                <td className="fw-bold">{section.name}</td>
                                <td className="text-center">
                                    {canModifySections && (
                                        <div className="d-flex justify-content-center gap-2 flex-wrap">
                                            <Button
                                                size="sm"
                                                variant="outline-primary"
                                                onClick={() => handleViewSectionProducts(section.sectionId)}
                                                title={`View products in ${section.name || 'this section'}`}
                                            >
                                                <BoxSeam /> <span className="d-none d-md-inline">Products</span>
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline-warning"
                                                onClick={() => handleShowEditModal(section)}
                                                title="Edit Section"
                                            >
                                                <PencilSquare /> <span className="d-none d-md-inline">Edit</span>
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline-danger"
                                                onClick={() => handleShowDeleteModal(section)}
                                                title="Delete Section"
                                            >
                                                <Trash /> <span className="d-none d-md-inline">Delete</span>
                                            </Button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}

            {/* Modal for Creating a New Section */}
            <Modal show={showModal} onHide={handleCloseModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton>
                    <Modal.Title>Create New Section</Modal.Title>
                </Modal.Header>
                <Form noValidate onSubmit={(e) => { e.preventDefault(); handleCreateSection(); }}>
                    <Modal.Body>
                        <Form.Group className="mb-3" controlId="createSectionName">
                            <Form.Label>Section Name</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter section name"
                                value={newSectionName}
                                onChange={(e) => setNewSectionName(e.target.value)}
                                required
                                autoFocus
                                maxLength={100}
                            />
                            <Form.Control.Feedback type="invalid">Please provide a name.</Form.Control.Feedback>
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button variant="success" type="submit">
                            <PlusLg className="me-2" /> Create Section
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* Modal for Editing Section */}
            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Section</Modal.Title>
                </Modal.Header>
                <Form noValidate onSubmit={(e) => { e.preventDefault(); handleEditSection(); }}>
                    <Modal.Body>
                        <Form.Group className="mb-3" controlId="editSectionName">
                            <Form.Label>Section Name</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter new section name"
                                value={newSectionName}
                                onChange={(e) => setNewSectionName(e.target.value)}
                                required
                                autoFocus
                                maxLength={100}
                            />
                            <Form.Control.Feedback type="invalid">Please provide a name.</Form.Control.Feedback>
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseEditModal}>
                            Cancel
                        </Button>
                        <Button variant="warning" type="submit">
                            <PencilSquare className="me-2" /> Update Section
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* Modal for Delete Confirmation */}
            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} centered backdrop="static" keyboard={false}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to delete the section named <strong>{sectionToDelete?.name}</strong>?</p>
                    <p className="text-danger">This action cannot be undone.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseDeleteModal}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDeleteSection}>
                        <Trash className="me-2" /> Delete Section
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default Sections;