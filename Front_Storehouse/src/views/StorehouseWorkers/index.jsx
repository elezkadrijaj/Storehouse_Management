import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Alert, Spinner, Badge, Button, Modal, Form } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import apiClient from '../../appService'; // REFACTORED: Import the centralized apiClient

// Note: The direct import for 'axios' and API_..._URL constants have been removed.

const SESSION_STORAGE_KEYS = { TOKEN: 'authToken' };

function StorehouseWorkers() {
    // --- All state hooks remain the same ---
    const [workers, setWorkers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [storehouseName, setStorehouseName] = useState('');
    const [searchParams] = useSearchParams();
    const storehouseId = searchParams.get('storehouseId');
    const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

    const [showAssignRoleModal, setShowAssignRoleModal] = useState(false);
    const [selectedWorkerForRole, setSelectedWorkerForRole] = useState(null);
    const [roleToAssign, setRoleToAssign] = useState('');
    const [isAssigningRole, setIsAssigningRole] = useState(false);
    const [confirmingEmailForWorkerId, setConfirmingEmailForWorkerId] = useState(null);
    const [assignableRoles, setAssignableRoles] = useState([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);

    const fetchStorehouseDataAndWorkers = useCallback(async (id, authToken) => {
        const parsedStorehouseId = parseInt(id, 10);
        if (!id || isNaN(parsedStorehouseId)) { setIsLoading(false); setError("Invalid Storehouse ID in URL."); return; }
        setIsLoading(true); setError(null);
        const config = { headers: { Authorization: `Bearer ${authToken}` } };
        
        try {
            // REFACTORED: Use apiClient with relative URLs in Promise.all
            const [storehouseResponse, workersResponse] = await Promise.all([
                apiClient.get(`/Storehouses/${parsedStorehouseId}`, config),
                apiClient.get(`/Storehouses/storehouses/${parsedStorehouseId}/workers`, config)
            ]);
            setStorehouseName(storehouseResponse.data.storehouseName || `ID: ${parsedStorehouseId}`);
            setWorkers(workersResponse.data);
        } catch (err) {
            if (err.response) {
                if (err.response.config?.url?.includes('/workers') && err.response.status === 404) {
                    setWorkers([]); // No workers found is not an error, just an empty list.
                    try { 
                        // Still try to get the storehouse name even if workers fetch failed
                        const storehouseRes = await apiClient.get(`/Storehouses/${parsedStorehouseId}`, config); 
                        setStorehouseName(storehouseRes.data.storehouseName || `ID: ${parsedStorehouseId}`); 
                    } catch { /* ignore error on fallback */ }
                } else { 
                    setError(err.response.data?.message || `Error: ${err.response.status}`); 
                }
            } else { 
                setError(err.message || "Network Error."); 
            }
        } finally { 
            setIsLoading(false); 
        }
    }, []);

    const fetchAssignableRoles = useCallback(async (authToken) => {
        setIsLoadingRoles(true);
        try {
            // REFACTORED: Use apiClient with a relative URL
            const response = await apiClient.get('/Account/assignable-roles', { headers: { Authorization: `Bearer ${authToken}` } });
            setAssignableRoles(response.data || []);
        } catch (err) { setError("Failed to load the list of assignable roles."); }
        finally { setIsLoadingRoles(false); }
    }, []);

    useEffect(() => {
        if (!token) { setError("Authentication Error: No token found."); setIsLoading(false); return; }
        fetchStorehouseDataAndWorkers(storehouseId, token);
        fetchAssignableRoles(token);
    }, [storehouseId, token, fetchStorehouseDataAndWorkers, fetchAssignableRoles]);

    const handleConfirmEmail = async (workerEmail, workerId) => {
        setConfirmingEmailForWorkerId(workerId); setError(null); setSuccessMessage(null);
        try {
            // REFACTORED: Use apiClient with a relative URL
            const response = await apiClient.post('/Account/confirm-email', { WorkerEmail: workerEmail }, { headers: { Authorization: `Bearer ${token}` } });
            setSuccessMessage(response.data.message || "Email confirmed successfully!");
            fetchStorehouseDataAndWorkers(storehouseId, token); // Refresh list
        } catch (err) { setError(err.response?.data?.message || "Failed to confirm email."); }
        finally { setConfirmingEmailForWorkerId(null); }
    };

    const openAssignRoleModal = (worker) => { setSelectedWorkerForRole(worker); setRoleToAssign(worker.role || ''); setShowAssignRoleModal(true); };
    const closeAssignRoleModal = () => { setShowAssignRoleModal(false); setSelectedWorkerForRole(null); setRoleToAssign(''); };

    const handleAssignRoleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedWorkerForRole || !roleToAssign) return;
        setIsAssigningRole(true); setError(null); setSuccessMessage(null);
        
        const payload = { Username: selectedWorkerForRole.username, Role: roleToAssign };
        const method = selectedWorkerForRole.role ? 'put' : 'post';
        // REFACTORED: Use relative URLs
        const url = selectedWorkerForRole.role ? '/Account/update-role' : '/Account/assign-role';
        
        try {
            // REFACTORED: Use apiClient with dynamic method/url
            const response = await apiClient({ method, url, data: payload, headers: { Authorization: `Bearer ${token}` } });
            setSuccessMessage(response.data.message || "Role updated successfully!");
            closeAssignRoleModal();
            fetchStorehouseDataAndWorkers(storehouseId, token); // Refresh list
        } catch (err) { setError(err.response?.data?.message || "Failed to update role."); }
        finally { setIsAssigningRole(false); }
    };

    // --- The entire return JSX remains exactly the same ---
    if (isLoading) { return (<div className="container mt-4 text-center"><Spinner animation="border" /><p className="mt-2">Loading...</p></div>); }
    if (error && !successMessage) { return (<div className="container mt-4"><h1>Storehouse Workers</h1><Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert></div>); }

    return (
        <div className="container mt-4">
            <h1>Workers for Storehouse: {storehouseName}</h1>
            {successMessage && (<Alert variant="success" className="mt-3" onClose={() => setSuccessMessage(null)} dismissible>{successMessage}</Alert>)}
            {error && (<Alert variant="danger" className="mt-3" onClose={() => setError(null)} dismissible>{error}</Alert>)}

            {workers.length > 0 ? (
                <Table striped bordered hover responsive size="sm" className="mt-3">
                    <thead><tr><th>#</th><th>Username</th><th>Email</th><th>Status</th><th>Role</th><th>Actions</th></tr></thead>
                    <tbody>
                        {workers.map((worker, index) => (
                            <tr key={worker.id}>
                                <td>{index + 1}</td><td>{worker.username}</td><td>{worker.email}</td>
                                <td><Badge bg={worker.emailConfirmed ? 'success' : 'warning'}>{worker.emailConfirmed ? 'Confirmed' : 'Pending'}</Badge></td>
                                <td>{worker.role ? <Badge bg="info">{worker.role}</Badge> : 'N/A'}</td>
                                <td>
                                    {!worker.emailConfirmed && (<Button size="sm" variant="outline-success" className="me-2" onClick={() => handleConfirmEmail(worker.email, worker.id)} disabled={confirmingEmailForWorkerId === worker.id}>{confirmingEmailForWorkerId === worker.id ? <Spinner as="span" size="sm" /> : "Confirm Email"}</Button>)}
                                    <Button size="sm" variant="outline-secondary" onClick={() => openAssignRoleModal(worker)}>{worker.role ? 'Update Role' : 'Assign Role'}</Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            ) : (<Alert variant="info" className="mt-3">No workers found assigned to this storehouse.</Alert>)}

            <Modal show={showAssignRoleModal} onHide={closeAssignRoleModal} centered>
                <Modal.Header closeButton><Modal.Title>{selectedWorkerForRole?.role ? 'Update' : 'Assign'} Role for <strong>{selectedWorkerForRole?.username}</strong></Modal.Title></Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleAssignRoleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label>Select Role</Form.Label>
                            <Form.Select value={roleToAssign} onChange={(e) => setRoleToAssign(e.target.value)} disabled={isLoadingRoles || isAssigningRole} required>
                                {isLoadingRoles ? (
                                    <option>Loading roles...</option>
                                ) : (
                                    <>
                                        <option value="">-- Please select a role --</option>
                                        {assignableRoles
                                            .filter(role => role.toLowerCase() === 'worker')
                                            .map((roleName) => (<option key={roleName} value={roleName}>{roleName}</option>))}
                                    </>
                                )}
                            </Form.Select>
                            {assignableRoles.filter(r => r.toLowerCase() === 'worker').length === 0 && !isLoadingRoles && (
                                <Form.Text className="text-muted">The "Worker" role is not available for assignment.</Form.Text>
                            )}
                        </Form.Group>
                        <Button variant="primary" type="submit" disabled={isAssigningRole || isLoadingRoles || !roleToAssign} className="w-100">
                            {isAssigningRole ? <Spinner as="span" size="sm" /> : (selectedWorkerForRole?.role ? 'Update Role' : 'Assign Role')}
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </div>
    );
}

export default StorehouseWorkers;