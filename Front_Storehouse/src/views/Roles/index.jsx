// src/views/AllRoles.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Table,
    Spinner,
    Alert,
    Container,
    Button,
    Modal,
    Form
} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

const API_ACCOUNT_BASE_URL = 'https://localhost:7204/api/Account';
const SESSION_STORAGE_KEYS = { TOKEN: 'authToken' };

function AllRoles() {
    const [roles, setRoles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

    const [showAddRoleModal, setShowAddRoleModal] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [isAddingRole, setIsAddingRole] = useState(false);
    const [addRoleError, setAddRoleError] = useState(null);
    const [addRoleSuccess, setAddRoleSuccess] = useState(null);

    // displayPageToast function is not used in this version,
    // errors/successes are handled directly with setError/setSuccessMessage
    // or modal-specific errors. If you want toasts, you'd add ToastContainer and the function.

    const fetchAllRoles = useCallback(async () => {
        if (!token) {
            setError("Authentication token not found. Please log in.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null); // Clear previous page errors before fetching
        try {
            // MODIFIED: Changed endpoint to /assignable-roles
            const response = await axios.get(`${API_ACCOUNT_BASE_URL}/assignable-roles`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Assuming the backend returns an array of role name strings
            // If it returns objects like { id: '...', name: '...' }, adjust here.
            // For simplicity, if it's just names, we'll map them to the structure needed.
            if (Array.isArray(response.data)) {
                if (response.data.length > 0 && typeof response.data[0] === 'string') {
                    // If it's an array of strings, map to objects for consistency if needed for edit/delete later
                    setRoles(response.data.map(name => ({ id: name, name: name }))); // Or just setRoles(response.data) if you only need names
                } else {
                    // If it's already an array of objects like {id, name}
                    setRoles(response.data);
                }
            } else {
                setRoles([]);
            }
        } catch (err) {
            console.error("Error fetching roles:", err.response || err);
            let errorMessage = "An unexpected error occurred while fetching roles.";
            if (err.response) {
                errorMessage = err.response.data?.message || `Error: ${err.response.status}`;
            } else if (err.request) {
                errorMessage = "Network Error. Could not connect to the server.";
            } else {
                errorMessage = err.message;
            }
            setError(errorMessage);
            setRoles([]);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchAllRoles();
    }, [fetchAllRoles]);

    const handleOpenAddRoleModal = () => {
        setNewRoleName('');
        setAddRoleError(null);
        setAddRoleSuccess(null);
        setShowAddRoleModal(true);
    };

    const handleCloseAddRoleModal = () => {
        setShowAddRoleModal(false);
    };

    const handleNewRoleNameChange = (e) => {
        setNewRoleName(e.target.value);
    };

    const handleAddRoleSubmit = async (e) => {
        e.preventDefault();
        // ... (handleAddRoleSubmit logic remains the same as provided in the previous version)
        if (!newRoleName.trim()) {
            setAddRoleError("Role name cannot be empty.");
            return;
        }
        if (!token) {
            setAddRoleError("Authentication required.");
            return;
        }
        setIsAddingRole(true);
        setAddRoleError(null);
        setAddRoleSuccess(null);
        try {
            const response = await axios.post(
                `${API_ACCOUNT_BASE_URL}/add-role`,
                JSON.stringify(newRoleName.trim()),
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            setAddRoleSuccess(response.data.message || "Role added successfully!");
            setNewRoleName('');
            await fetchAllRoles();
            setTimeout(() => {
                if (showAddRoleModal) {
                     handleCloseAddRoleModal();
                }
            }, 2000);
        } catch (err) {
            console.error("Error adding role:", err.response || err);
            let detailedError = "An error occurred while adding the role.";
            if (err.response?.data) {
                if (Array.isArray(err.response.data)) { 
                    detailedError = err.response.data.map(eObj => eObj.description || eObj.message || "Unknown error").join('; ');
                } else if (err.response.data.message) {
                    detailedError = err.response.data.message;
                } else if (typeof err.response.data === 'string') { 
                    detailedError = err.response.data;
                } else {
                    detailedError = `Server responded with status ${err.response.status}.`;
                }
            } else if (err.request) {
                detailedError = "Network Error. Could not connect to the server.";
            } else {
                detailedError = err.message || "An unknown error occurred.";
            }
            setAddRoleError(detailedError);
        } finally {
            setIsAddingRole(false);
        }
    };

    const handleEditRole = (role) => {
        alert(`Edit role: ${role.name} (ID: ${role.id}) - Functionality not yet implemented.`);
    };

    const handleDeleteRole = (role) => {
        if (window.confirm(`Are you sure you want to delete the role: ${role.name}? This is a critical action.`)) {
            alert(`Delete role: ${role.name} (ID: ${role.id}) - Functionality not yet implemented.`);
        }
    };

    if (isLoading && roles.length === 0 && !error) {
        return (
            <Container className="mt-4 text-center">
                <Spinner animation="border" />
                <p>Loading roles...</p>
            </Container>
        );
    }

    return (
        <Container className="mt-4">
            {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
            {successMessage && <Alert variant="success" className="mb-3">{successMessage}</Alert>}

            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1>All System Roles</h1>
                <Button variant="success" onClick={handleOpenAddRoleModal}>
                    + Create New Role
                </Button>
            </div>

            {isLoading && roles.length > 0 && <div className="text-center my-2"><Spinner animation="grow" size="sm" /> Refreshing list...</div>}

            {roles.length === 0 && !isLoading && !error && (
                <Alert variant="info">No roles found in the system.</Alert>
            )}

            {roles.length > 0 && (
                <Table striped bordered hover responsive size="sm">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Role Name</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {roles.map((role, index) => (
                            // Assuming 'role' is now an object like { id: 'roleName', name: 'roleName' }
                            // or just a string if your backend returns a string array for /assignable-roles
                            <tr key={typeof role === 'object' ? role.id : role || index}>
                                <td>{index + 1}</td>
                                <td>{typeof role === 'object' ? role.name : role}</td>
                                <td>
                                    <Button
                                        variant="outline-warning"
                                        size="sm"
                                        className="me-2"
                                        onClick={() => handleEditRole(role)}
                                        disabled
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={() => handleDeleteRole(role)}
                                        disabled
                                    >
                                        Delete
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}

            {/* Add New Role Modal (remains the same) */}
            <Modal show={showAddRoleModal} onHide={handleCloseAddRoleModal} centered backdrop="static">
                <Modal.Header closeButton>
                    <Modal.Title>Add New Role</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {addRoleError && <Alert variant="danger" onClose={() => setAddRoleError(null)} dismissible>{addRoleError}</Alert>}
                    {addRoleSuccess && <Alert variant="success" onClose={() => setAddRoleSuccess(null)} dismissible>{addRoleSuccess}</Alert>}
                    <Form onSubmit={handleAddRoleSubmit}>
                        <Form.Group className="mb-3" controlId="newRoleNameInput">
                            <Form.Label>Role Name</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter new role name"
                                value={newRoleName}
                                onChange={handleNewRoleNameChange}
                                required
                                disabled={isAddingRole}
                                autoFocus
                            />
                        </Form.Group>
                        <Button variant="primary" type="submit" disabled={isAddingRole || !newRoleName.trim()} className="w-100">
                            {isAddingRole ? ( <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Adding Role...</> ) : ( 'Add Role' )}
                        </Button>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseAddRoleModal} disabled={isAddingRole}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}

export default AllRoles;