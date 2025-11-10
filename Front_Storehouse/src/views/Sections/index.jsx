import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Table, Button, Modal, Form, Spinner, Alert } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { PencilSquare, Trash, BoxSeam, PlusLg } from 'react-bootstrap-icons';
import apiClient from '../../appService';

// REFACTORED: Removed TOKEN and other unnecessary keys.
const SESSION_STORAGE_KEYS = {
    USER_ROLE: 'userRole',
};

function Sections() {
    // All state hooks remain the same.
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

    const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
    const canModifySections = userRole?.toLowerCase() === 'companymanager' || userRole?.toLowerCase() === 'storehousemanager';

    // This navigation function is correct and remains unchanged.
    const handleViewSectionProducts = (sectionId) => {
        if (!sectionId) {
            toast.warn("Cannot view products (missing Section ID).");
            return;
        }
        navigate(`/app/product?storehouseId=${storehouseId}&sectionId=${sectionId}`);
    };

    const fetchSections = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSections([]);
        setStorehouseName('');
        try {
            // REFACTORED: No auth config needed. Browser handles the cookie.
            const [storehouseRes, sectionsRes] = await Promise.all([
                apiClient.get(`/Storehouses/${storehouseId}`),
                apiClient.get(`/Storehouses/${storehouseId}/Sections`)
            ]);

            setStorehouseName(storehouseRes.data.storehouseName);
            setSections(sectionsRes.data);

        } catch (err) {
            console.error('Error fetching data:', err);
            setError(err.response?.data?.message || 'Failed to load section data.');
        } finally {
            setLoading(false);
        }
    }, [storehouseId]);

    useEffect(() => {
        const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
        if (!userRole) {
            setError("You are not logged in. Please log in to view sections.");
            setLoading(false);
            return;
        }
        if (storehouseId) {
            fetchSections();
        } else {
            setError("No Storehouse ID provided in the URL.");
            setLoading(false);
        }
    }, [storehouseId, fetchSections]);


    const handleCreateSection = async () => {
        if (!newSectionName.trim()) {
            toast.warn('Section name cannot be empty.');
            return;
        }
        try {
            const newSection = {
                name: newSectionName,
                storehousesId: parseInt(storehouseId, 10),
            };

            // REFACTORED: Simplified API call.
            const response = await apiClient.post('/Sections', newSection);
            toast.success('Section created successfully!');
            setSections(prev => [...prev, response.data]);
            handleCloseModal();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error creating section.');
        }
    };

    const handleEditSection = async () => {
        if (!selectedSection) return;
        if (!newSectionName.trim()) {
            toast.warn('Section name cannot be empty.');
            return;
        }

        try {
            const updatedSection = {
                ...selectedSection,
                name: newSectionName,
            };

            // REFACTORED: Simplified API call with relative URL.
            await apiClient.put(`/Sections/${selectedSection.sectionId}`, updatedSection);
            toast.success('Section updated successfully!');
            setSections(sections.map(s => s.sectionId === selectedSection.sectionId ? updatedSection : s));
            handleCloseEditModal();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error updating section.');
        }
    };
    
    const handleDeleteSection = async () => {
        if (!sectionToDelete) return;
        try {
            // REFACTORED: Simplified API call with relative URL.
            await apiClient.delete(`/Sections/${sectionToDelete.sectionId}`);
            toast.success('Section deleted successfully!');
            setSections(sections.filter(s => s.sectionId !== sectionToDelete.sectionId));
            handleCloseDeleteModal();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error deleting section.');
        }
    };
    
    // All other handlers and the JSX remain the same.
    const handleOpenModal = () => setShowModal(true);
    const handleCloseModal = () => { setShowModal(false); setNewSectionName(''); };
    const handleShowEditModal = (section) => { setSelectedSection(section); setNewSectionName(section.name); setShowEditModal(true); };
    const handleCloseEditModal = () => { setShowEditModal(false); setSelectedSection(null); setNewSectionName(''); };
    const handleShowDeleteModal = (section) => { setSectionToDelete(section); setShowDeleteModal(true); };
    const handleCloseDeleteModal = () => { setShowDeleteModal(false); setSectionToDelete(null); };

    // --- The entire return JSX remains exactly the same ---
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
            {loading && <div className="d-flex justify-content-center" style={{ height: "50vh" }}><Spinner animation="border" variant="primary" /></div>}

            {!loading && sections.length === 0 && !error && (
                <Alert variant="info" className="text-center py-4"><h4>No Sections Found</h4><p className="mb-0">This storehouse has no sections. Click 'Create Section' to add one.</p></Alert>
            )}

            {!loading && sections.length > 0 && (
                <Table striped bordered hover responsive="lg" className="align-middle shadow-sm">
                    <thead style={{ backgroundColor: '#4F5D75', color: 'white' }}>
                        <tr><th>Section Name</th><th className="text-center">Actions</th></tr>
                    </thead>
                    <tbody>
                        {sections.map((section) => (
                            <tr key={section.sectionId}>
                                <td className="fw-bold">{section.name}</td>
                                <td className="text-center">
                                    {canModifySections && (
                                        <div className="d-flex justify-content-center gap-2 flex-wrap">
                                            <Button size="sm" variant="outline-primary" onClick={() => handleViewSectionProducts(section.sectionId)}><BoxSeam /> <span className="d-none d-md-inline">Products</span></Button>
                                            <Button size="sm" variant="outline-warning" onClick={() => handleShowEditModal(section)}><PencilSquare /> <span className="d-none d-md-inline">Edit</span></Button>
                                            <Button size="sm" variant="outline-danger" onClick={() => handleShowDeleteModal(section)}><Trash /> <span className="d-none d-md-inline">Delete</span></Button>
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
                <Modal.Header closeButton><Modal.Title>Create New Section</Modal.Title></Modal.Header>
                <Form noValidate onSubmit={(e) => { e.preventDefault(); handleCreateSection(); }}>
                    <Modal.Body><Form.Group className="mb-3"><Form.Label>Section Name</Form.Label><Form.Control type="text" placeholder="Enter section name" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} required autoFocus maxLength={100} /></Form.Group></Modal.Body>
                    <Modal.Footer><Button variant="secondary" onClick={handleCloseModal}>Cancel</Button><Button variant="success" type="submit"><PlusLg className="me-2" /> Create</Button></Modal.Footer>
                </Form>
            </Modal>

            {/* Modal for Editing Section */}
            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton><Modal.Title>Edit Section</Modal.Title></Modal.Header>
                <Form noValidate onSubmit={(e) => { e.preventDefault(); handleEditSection(); }}>
                    <Modal.Body><Form.Group className="mb-3"><Form.Label>Section Name</Form.Label><Form.Control type="text" placeholder="Enter new name" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} required autoFocus maxLength={100} /></Form.Group></Modal.Body>
                    <Modal.Footer><Button variant="secondary" onClick={handleCloseEditModal}>Cancel</Button><Button variant="warning" type="submit"><PencilSquare className="me-2" /> Update</Button></Modal.Footer>
                </Form>
            </Modal>

            {/* Modal for Delete Confirmation */}
            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} centered backdrop="static" keyboard={false}>
                <Modal.Header closeButton><Modal.Title>Confirm Deletion</Modal.Title></Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to delete section <strong>{sectionToDelete?.name}</strong>?</p>
                    <p className="text-danger">This cannot be undone.</p>
                </Modal.Body>
                <Modal.Footer><Button variant="secondary" onClick={handleCloseDeleteModal}>Cancel</Button><Button variant="danger" onClick={handleDeleteSection}><Trash className="me-2" /> Delete</Button></Modal.Footer>
            </Modal>
        </div>
    );
}

export default Sections;