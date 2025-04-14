import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
// Import your cookie utility
import cookieUtils from 'views/auth/cookieUtils'; // Adjust path if needed
import { Card, Col, Row, Button, Modal, Form } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
    const userRole = cookieUtils.getUserRoleFromCookies();
    // Determine if the user has the required role (case-insensitive check is safer)
    const lowerCaseRole = userRole?.toLowerCase();
    const canModifySections = userRole?.toLowerCase() === 'companymanager';

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
            const token = cookieUtils.getCookie('token');

            if (!token) {
                setError('No token found. Please log in.');
                setLoading(false);
                return;
            }

            const config = { headers: { Authorization: `Bearer ${token}` } };

            // Use Promise.all to fetch concurrently (optional optimization)
            const [storehouseRes, sectionsRes] = await Promise.all([
                axios.get(`https://localhost:7204/api/Storehouses/${storehouseId}`, config),
                axios.get(`https://localhost:7204/api/Storehouses/${storehouseId}/Sections`, config)
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
            const token = cookieUtils.getCookie('token');
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

            const response = await axios.post('https://localhost:7204/api/Sections', newSection, config);
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
            const token = cookieUtils.getCookie('token');

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

            await axios.put(
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
            const token = cookieUtils.getCookie('token');
            if (!token) {
                toast.error('No token found. Please log in.');
                return;
            }

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            };

            await axios.delete(
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
        <div className="container mt-4"> {/* Added mt-4 for spacing */}
            <ToastContainer position="top-right" autoClose={3000} />

            <h2>Sections for Storehouse: {storehouseName || (loading ? "Loading..." : "N/A")}</h2>

            {error && <div className="alert alert-danger">{error}</div>}

            {/* Conditionally render Create button */}
            {canModifySections && !loading && (
                <Button variant="primary" onClick={handleOpenModal} className="mb-3">
                    Create Section
                </Button>
            )}

            {loading && <div className="d-flex justify-content-center"><div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div></div>}

            {!loading && sections.length === 0 && !error && (
                <p>No sections found for this storehouse.</p>
            )}

            {!loading && sections.length > 0 && (
                <Row xs={1} md={2} lg={3} className="g-4">
                    {sections.map((section) => (
                        <Col key={section.sectionId}>
                            <Card>
                                <Card.Body>
                                    <Card.Title>{section.name}</Card.Title>
                                    {/* Conditionally render Edit/Delete buttons */}
                                    {canModifySections && (
                                        <div className="d-flex justify-content-end mt-2"> {/* Group buttons */}
                                            <Button size="sm" variant="outline-info" onClick={() => handleViewSectionProducts(section.sectionId)} title={`View products in ${section.name || 'this section'}`}>
                                                <i className="bi bi-box-seam me-1"></i> Products
                                            </Button>
                                            <Button size="sm" variant="warning" onClick={() => handleShowEditModal(section)} className="me-2"> {/* Use margin-end */}
                                                Edit
                                            </Button>
                                            <Button size="sm" variant="danger" onClick={() => handleShowDeleteModal(section)}>
                                                Delete
                                            </Button>
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}


            {/* Modals remain the same, they are only shown when triggered by the buttons */}
            {/* Modal for Creating a New Section */}
            <Modal show={showModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Create New Section</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={(e) => { e.preventDefault(); handleCreateSection(); }}> {/* Allow Enter key submission */}
                        <Form.Group className="mb-3" controlId="createSectionName">
                            <Form.Label>Section Name</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter name"
                                value={newSectionName}
                                onChange={(e) => setNewSectionName(e.target.value)}
                                required
                                autoFocus // Focus the input when modal opens
                            />
                        </Form.Group>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={handleCloseModal}>
                                Cancel
                            </Button>
                            <Button variant="primary" type="submit"> {/* Submit the form */}
                                Create Section
                            </Button>
                        </Modal.Footer>
                    </Form>
                </Modal.Body>
                {/* Footer moved inside Form for better structure */}
            </Modal>

            {/* Modal for Editing Section */}
            <Modal show={showEditModal} onHide={handleCloseEditModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Section</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={(e) => { e.preventDefault(); handleEditSection(); }}>
                        <Form.Group className="mb-3" controlId="editSectionName">
                            <Form.Label>Section Name</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter new section name"
                                value={newSectionName}
                                onChange={(e) => setNewSectionName(e.target.value)}
                                required
                                autoFocus
                            />
                        </Form.Group>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={handleCloseEditModal}>
                                Cancel
                            </Button>
                            <Button variant="primary" type="submit">
                                Update Section
                            </Button>
                        </Modal.Footer>
                    </Form>
                </Modal.Body>
                {/* Footer moved inside Form */}
            </Modal>

            {/* Modal for Delete Confirmation */}
            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} centered> {/* Optional: Center delete modal */}
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
                        Delete Section
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default Sections;