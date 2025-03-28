import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils';
import { Card, Col, Row, Button, Modal, Form } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function Sections() {
    const [searchParams] = useSearchParams();
    const storehouseId = searchParams.get('storehouseId');

    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [storehouseName, setStorehouseName] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [newSectionName, setNewSectionName] = useState('');

    const [showEditModal, setShowEditModal] = useState(false);  // New modal for editing
    const [selectedSection, setSelectedSection] = useState(null); // State to store the section being edited

    // State for Delete Confirmation Modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [sectionToDelete, setSectionToDelete] = useState(null);

    useEffect(() => {
        if (storehouseId) {
            fetchSections();
        }
    }, [storehouseId]);

    const fetchSections = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = cookieUtils.getCookie('token');

            if (!token) {
                setError('No token found. Please log in.');
                setLoading(false);
                return;
            }

            const config = { headers: { Authorization: `Bearer ${token}` } };

            // Fetch Storehouse Name
            try {
                const storehouseResponse = await axios.get(
                    `https://localhost:7204/api/Storehouses/${storehouseId}`,
                    config
                );
                setStorehouseName(storehouseResponse.data.storehouseName);
            } catch (storehouseErr) {
                console.error('Error fetching storehouse name:', storehouseErr);
                setError('Failed to load storehouse name.');
                setLoading(false);
                return;
            }

            // Fetch Sections
            const response = await axios.get(
                `https://localhost:7204/api/Storehouses/${storehouseId}/Sections`,
                config
            );

            setSections(response.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching sections:', err);
            setError(err.message || 'Failed to load sections.');
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

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            };

            const newSection = {
                name: newSectionName,
                storehousesId: parseInt(storehouseId, 10),
            };

            await axios.post('https://localhost:7204/api/Sections', newSection, config);
            toast.success('Section created successfully!');

            fetchSections(); // Refresh sections list
            handleCloseModal();
        } catch (err) {
            console.error('Error creating section:', err);
            toast.error(err.response?.data?.message || 'Error creating section.');
        }
    };

    const handleShowEditModal = (section) => {
        setSelectedSection(section);  // Set the section to edit
        setNewSectionName(section.name);  // Pre-fill the form with the section data
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
        setSectionToDelete(section);  // Set the section to delete
        setShowDeleteModal(true);  // Show the delete confirmation modal
    };

    const handleCloseDeleteModal = () => {
        setShowDeleteModal(false);
        setSectionToDelete(null);  // Clear the section to delete
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

            // Refresh sections list after deletion
            setSections(sections.filter((section) => section.sectionId !== sectionToDelete.sectionId));

            handleCloseDeleteModal();  // Close the delete confirmation modal
        } catch (err) {
            console.error('Error deleting section:', err);
            toast.error(err.response?.data?.message || 'Error deleting section.');
        }
    };

    return (
        <div className="container">
            <ToastContainer position="top-right" autoClose={3000} />

            <h2>Sections for Storehouse: {storehouseName || "Loading..."}</h2>

            {error && <div className="alert alert-danger">{error}</div>}
            {loading && <div>Loading sections...</div>}

            <Button variant="primary" onClick={handleOpenModal}>
                Create Section
            </Button>

            <Row xs={1} md={2} lg={3} className="g-4 mt-3">
                {sections.map((section) => (
                    <Col key={section.sectionId}>
                        <Card>
                            <Card.Body>
                                <Card.Title>{section.name}</Card.Title>
                                <Button variant="warning" onClick={() => handleShowEditModal(section)}>
                                    Edit
                                </Button>
                                <Button variant="danger" className="ml-2" onClick={() => handleShowDeleteModal(section)}>
                                    Delete
                                </Button>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Modal for Creating a New Section */}
            <Modal show={showModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Create New Section</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Section Name</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter name"
                                value={newSectionName}
                                onChange={(e) => setNewSectionName(e.target.value)}
                                required
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleCreateSection}>
                        Create Section
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Modal for Editing Section */}
            <Modal show={showEditModal} onHide={handleCloseEditModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Edit Section</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Section Name</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter new section name"
                                value={newSectionName}
                                onChange={(e) => setNewSectionName(e.target.value)}
                                required
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseEditModal}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleEditSection}>
                        Update Section
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Modal for Delete Confirmation */}
            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Delete Section</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to delete this section?</p>
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
