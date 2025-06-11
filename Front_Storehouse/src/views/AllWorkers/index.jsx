import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import {
    Table, Alert, Spinner, Badge, Button, Modal, Form, Row, Col, ListGroup, Toast, ToastContainer
} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

const API_ACCOUNT_BASE_URL = 'https://localhost:7204/api/Account';
const API_CONTRACT_BASE_URL = 'https://localhost:7204/api/WorkContract';
const API_STOREHOUSES_BASE_URL = 'https://localhost:7204/api/Storehouses';
const SESSION_STORAGE_KEYS = { TOKEN: 'authToken' };

function AllWorkers() {
    const [workers, setWorkers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [businessNumber, setBusinessNumber] = useState(null);
    const [showContractModal, setShowContractModal] = useState(false);
    const [selectedWorkerForContract, setSelectedWorkerForContract] = useState(null);
    const [contractModalMode, setContractModalMode] = useState('view');
    const [currentContractData, setCurrentContractData] = useState(null);
    const [contractFormData, setContractFormData] = useState({ workContractId: 0, userId: '', startDate: '', endDate: '', salary: '', contractFileUrl: '' });
    const [isContractLoading, setIsContractLoading] = useState(false);
    const [contractError, setContractError] = useState(null);
    const [contractSuccessMessage, setContractSuccessMessage] = useState(null);
    const [showRegisterWorkerModal, setShowRegisterWorkerModal] = useState(false);
    const [registerWorkerFormData, setRegisterWorkerFormData] = useState({ username: '', email: '', password: '', storehouseName: '' });
    const [isRegisteringWorker, setIsRegisteringWorker] = useState(false);
    const [registerWorkerError, setRegisterWorkerError] = useState(null);
    const [registerWorkerSuccess, setRegisterWorkerSuccess] = useState(null);
    const [confirmingEmailForWorkerId, setConfirmingEmailForWorkerId] = useState(null);
    const [showAssignRoleModal, setShowAssignRoleModal] = useState(false);
    const [selectedWorkerForRole, setSelectedWorkerForRole] = useState(null);
    const [roleToAssign, setRoleToAssign] = useState('');
    const [isAssigningRole, setIsAssigningRole] = useState(false);
    const [assignableRolesList, setAssignableRolesList] = useState([]);
    const [isLoadingAssignableRoles, setIsLoadingAssignableRoles] = useState(false);
    const [storehouseList, setStorehouseList] = useState([]);
    const [isLoadingStorehouses, setIsLoadingStorehouses] = useState(false);

    const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

    const displayToast = (message, type = 'info') => {
        if (type === 'success') {
            setSuccessMessage(message);
            setError(null);
        } else {
            setError(message);
            setSuccessMessage(null);
        }
    };

    const fetchWorkersData = useCallback(async (currentBusinessNumber, currentToken) => {
        setIsLoading(true);
        const API_URL = `${API_ACCOUNT_BASE_URL}/all-workers/${encodeURIComponent(currentBusinessNumber)}`;
        const config = { headers: { Authorization: `Bearer ${currentToken}` } };
        try {
            const response = await axios.get(API_URL, config);
            setWorkers(response.data);
        } catch (err) {
            let errorMessage = "An unexpected error occurred while fetching workers.";
            if (err.response) {
                if (err.response.status === 404) errorMessage = `No workers found for business number: ${currentBusinessNumber}.`;
                else if (err.response.status === 401 || err.response.status === 403) errorMessage = "Authorization failed to fetch workers.";
                else errorMessage = err.response.data?.message || `Error fetching workers: ${err.response.status}`;
            } else if (err.request) errorMessage = "Network Error while fetching workers.";
            else errorMessage = err.message;
            displayToast(errorMessage, 'error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchStorehouses = useCallback(async () => {
        if (!token) return;
        setIsLoadingStorehouses(true);
        try {
            const response = await axios.get(`${API_STOREHOUSES_BASE_URL}/for-dropdown`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStorehouseList(response.data || []);
        } catch (err) {
            displayToast("Failed to load storehouse list.", 'error');
            setStorehouseList([]);
        } finally {
            setIsLoadingStorehouses(false);
        }
    }, [token]);

    const fetchAssignableRoles = useCallback(async (currentToken) => {
        if (!currentToken) return;
        setIsLoadingAssignableRoles(true);
        try {
            const response = await axios.get(`${API_ACCOUNT_BASE_URL}/assignable-roles`, {
                headers: { Authorization: `Bearer ${currentToken}` }
            });
            setAssignableRolesList(response.data || []);
        } catch (err) {
            displayToast("Failed to load assignable roles.", 'error');
            setAssignableRolesList([]);
        } finally {
            setIsLoadingAssignableRoles(false);
        }
    }, []);

    useEffect(() => {
        let decodedToken, extractedBusinessNumber, extractedRole;
        if (token) {
            try {
                decodedToken = jwtDecode(token);
                extractedBusinessNumber = decodedToken.CompanyBusinessNumber;
                setBusinessNumber(extractedBusinessNumber);
                const roleClaimName = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
                extractedRole = decodedToken[roleClaimName];
            } catch (e) {
                displayToast("Invalid or expired token.", 'error'); setIsLoading(false); return;
            }
        } else {
            displayToast("Authentication token not found.", 'error'); setIsLoading(false); return;
        }

        if (extractedRole?.toLowerCase() !== 'companymanager') {
            displayToast("Access Denied: Company Manager role required.", 'error'); setIsLoading(false); return;
        }
        if (!extractedBusinessNumber) {
            displayToast("Company Business Number not found in token.", 'error'); setIsLoading(false); return;
        }
        fetchWorkersData(extractedBusinessNumber, token);
        fetchAssignableRoles(token);
    }, [token, fetchWorkersData, fetchAssignableRoles]);

    const fetchContractDetailsForModal = useCallback(async (workerId) => {
        if (!token || !workerId) return;
        setIsContractLoading(true);
        setContractError(null);
        try {
            const response = await axios.get(`${API_CONTRACT_BASE_URL}/user/${workerId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCurrentContractData(response.data);
            setContractFormData({
                workContractId: response.data.workContractId, userId: response.data.userId,
                startDate: response.data.startDate ? new Date(response.data.startDate).toISOString().split('T')[0] : '',
                endDate: response.data.endDate ? new Date(response.data.endDate).toISOString().split('T')[0] : '',
                salary: response.data.salary?.toString() || '', contractFileUrl: response.data.contractFileUrl || ''
            });
            setContractModalMode('view');
        } catch (err) {
            if (err.response && err.response.status === 404) {
                setCurrentContractData(null);
                setContractFormData({ workContractId: 0, userId: workerId, startDate: '', endDate: '', salary: '', contractFileUrl: '' });
                setContractModalMode('view');
            } else {
                setContractError(err.response?.data?.message || "Failed to fetch contract details.");
                setCurrentContractData(null);
            }
        } finally {
            setIsContractLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (showContractModal && selectedWorkerForContract) {
            fetchContractDetailsForModal(selectedWorkerForContract.id);
        } else {
            setCurrentContractData(null);
            setContractFormData({ workContractId: 0, userId: '', startDate: '', endDate: '', salary: '', contractFileUrl: '' });
            setContractModalMode('view');
            setContractError(null);
            setContractSuccessMessage(null);
        }
    }, [showContractModal, selectedWorkerForContract, fetchContractDetailsForModal]);

    const handleShowContractModal = (worker) => {
        setSelectedWorkerForContract(worker);
        setShowContractModal(true);
    };

    const handleCloseContractModal = () => setShowContractModal(false);

    const handleContractFormInputChange = (e) => {
        setContractFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleContractFormSubmit = async (e) => {
        e.preventDefault();
        setIsContractLoading(true);
        const payload = { ...contractFormData, salary: parseFloat(contractFormData.salary) || 0 };
        if (contractModalMode === 'create') delete payload.workContractId;
        const url = contractModalMode === 'create' ? API_CONTRACT_BASE_URL : `${API_CONTRACT_BASE_URL}/${payload.workContractId}`;
        const method = contractModalMode === 'create' ? 'post' : 'put';
        try {
            const response = await axios[method](url, payload, { headers: { Authorization: `Bearer ${token}` } });
            setContractSuccessMessage(response.data.message || "Contract saved successfully!");
            fetchContractDetailsForModal(selectedWorkerForContract.id);
        } catch (err) {
            setContractError(err.response?.data?.message || `Failed to ${contractModalMode} contract.`);
        } finally {
            setIsContractLoading(false);
        }
    };

    const handleDeleteContract = async () => {
        if (!currentContractData?.workContractId || !window.confirm("Are you sure?")) return;
        setIsContractLoading(true);
        try {
            await axios.delete(`${API_CONTRACT_BASE_URL}/${currentContractData.workContractId}`, { headers: { Authorization: `Bearer ${token}` } });
            setContractSuccessMessage("Contract deleted successfully!");
            setCurrentContractData(null);
            setContractFormData({ workContractId: 0, userId: selectedWorkerForContract?.id || '', startDate: '', endDate: '', salary: '', contractFileUrl: '' });
        } catch (err) {
            setContractError(err.response?.data?.message || "Failed to delete contract.");
        } finally {
            setIsContractLoading(false);
        }
    };

    const openRegisterWorkerModal = () => {
        setRegisterWorkerFormData({ username: '', email: '', password: '', storehouseName: '' });
        setRegisterWorkerError(null);
        setRegisterWorkerSuccess(null);
        fetchStorehouses();
        setShowRegisterWorkerModal(true);
    };

    const closeRegisterWorkerModal = () => {
        setShowRegisterWorkerModal(false);
        setStorehouseList([]);
    };

    const handleRegisterWorkerInputChange = (e) => {
        setRegisterWorkerFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRegisterWorkerSubmit = async (e) => {
        e.preventDefault();
        setIsRegisteringWorker(true);
        setRegisterWorkerError(null);
        const payload = { ...registerWorkerFormData, CompanyBusinessNumber: businessNumber };
        try {
            const response = await axios.post(`${API_ACCOUNT_BASE_URL}/register-worker`, payload, { headers: { Authorization: `Bearer ${token}` } });
            setRegisterWorkerSuccess(response.data.message || "Worker registered successfully!");
            fetchWorkersData(businessNumber, token);
        } catch (err) {
            const errorData = err.response?.data;
            let errorMessage = "An unexpected error occurred.";
            if (typeof errorData === 'string') errorMessage = errorData;
            else if (errorData?.message) errorMessage = errorData.message;
            else if (errorData?.errors) errorMessage = Object.values(errorData.errors).flat().join(' ');
            setRegisterWorkerError(errorMessage);
        } finally {
            setIsRegisteringWorker(false);
        }
    };

    const handleConfirmEmail = async (workerEmail, workerId) => {
        setConfirmingEmailForWorkerId(workerId);
        try {
            const response = await axios.post(`${API_ACCOUNT_BASE_URL}/confirm-email`, { WorkerEmail: workerEmail }, { headers: { Authorization: `Bearer ${token}` } });
            displayToast(response.data.message || "Email confirmed.", 'success');
            fetchWorkersData(businessNumber, token);
        } catch (err) {
            displayToast(err.response?.data?.message || "Failed to confirm email.", 'error');
        } finally {
            setConfirmingEmailForWorkerId(null);
        }
    };

    const openAssignRoleModal = (worker) => {
        setSelectedWorkerForRole(worker);
        if (assignableRolesList.length === 0 && !isLoadingAssignableRoles) fetchAssignableRoles(token);
        setRoleToAssign(worker.role || '');
        setShowAssignRoleModal(true);
    };

    const closeAssignRoleModal = () => setShowAssignRoleModal(false);

    const handleRoleToAssignChange = (e) => setRoleToAssign(e.target.value);

    const handleAssignRoleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedWorkerForRole || !roleToAssign) return;
        setIsAssigningRole(true);
        const payload = { Username: selectedWorkerForRole.username, Role: roleToAssign };
        const method = selectedWorkerForRole.role ? 'put' : 'post';
        const url = selectedWorkerForRole.role ? `${API_ACCOUNT_BASE_URL}/update-role` : `${API_ACCOUNT_BASE_URL}/assign-role`;
        try {
            const response = await axios({ method, url, data: payload, headers: { Authorization: `Bearer ${token}` } });
            displayToast(response.data.message || "Role updated successfully.", 'success');
            fetchWorkersData(businessNumber, token);
            closeAssignRoleModal();
        } catch (err) {
            displayToast(err.response?.data?.message || "Failed to update role.", 'error');
        } finally {
            setIsAssigningRole(false);
        }
    };
    
    return (
        <div className="container mt-4">
            <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1056 }}>
                {successMessage && (<Toast onClose={() => setSuccessMessage(null)} show={!!successMessage} delay={5000} autohide bg="success"><Toast.Header><strong className="me-auto">Success</strong></Toast.Header><Toast.Body className="text-white">{successMessage}</Toast.Body></Toast>)}
                {error && (<Toast onClose={() => setError(null)} show={!!error} delay={7000} autohide bg="danger"><Toast.Header><strong className="me-auto">Error</strong></Toast.Header><Toast.Body className="text-white">{error}</Toast.Body></Toast>)}
            </ToastContainer>

            <Row className="mb-3 align-items-center">
                <Col><h1>Company Workers</h1></Col>
                <Col xs="auto"><Button variant="primary" onClick={openRegisterWorkerModal}>Register New Worker</Button></Col>
            </Row>
            
            {isLoading ? (<div className="text-center my-4"><Spinner animation="border" /></div>)
            : workers.length > 0 ? (
                <Table striped bordered hover responsive size="sm">
                    <thead><tr><th>#</th><th>Username</th><th>Email</th><th>Status</th><th>Role</th><th>Storehouse</th><th>Actions</th></tr></thead>
                    <tbody>
                        {workers.map((worker, index) => (
                            <tr key={worker.id}>
                                <td>{index + 1}</td><td>{worker.username}</td><td>{worker.email}</td>
                                <td><Badge bg={worker.emailConfirmed ? 'success' : 'warning'}>{worker.emailConfirmed ? 'Confirmed' : 'Pending'}</Badge></td>
                                <td>{worker.role ? <Badge bg="secondary">{worker.role}</Badge> : <Badge bg="light" text="dark">N/A</Badge>}</td>
                                <td>{worker.storeHouseName || 'N/A'}</td>
                                <td>
                                    <Button size="sm" variant="outline-primary" className="me-2 mb-1 mb-md-0" onClick={() => handleShowContractModal(worker)}>Manage Contract</Button>
                                    {!worker.emailConfirmed && (<Button size="sm" variant="outline-success" className="me-2 mb-1 mb-md-0" onClick={() => handleConfirmEmail(worker.email, worker.id)} disabled={confirmingEmailForWorkerId === worker.id}>{confirmingEmailForWorkerId === worker.id ? <Spinner as="span" size="sm" /> : "Confirm"}</Button>)}
                                    <Button size="sm" variant="outline-warning" className="mb-1 mb-md-0" onClick={() => openAssignRoleModal(worker)}>{worker.role ? 'Update Role' : 'Assign Role'}</Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            ) : <Alert variant="info">No workers found for this business number.</Alert>}

            <Modal show={showRegisterWorkerModal} onHide={closeRegisterWorkerModal} centered backdrop="static">
                <Modal.Header closeButton><Modal.Title>Register New Worker</Modal.Title></Modal.Header>
                <Modal.Body>
                    {registerWorkerError && <Alert variant="danger">{registerWorkerError}</Alert>}
                    {registerWorkerSuccess && <Alert variant="success">{registerWorkerSuccess}</Alert>}
                    <Form onSubmit={handleRegisterWorkerSubmit}>
                        <Form.Group className="mb-3"><Form.Label>Username</Form.Label><Form.Control type="text" name="username" value={registerWorkerFormData.username} onChange={handleRegisterWorkerInputChange} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Email</Form.Label><Form.Control type="email" name="email" value={registerWorkerFormData.email} onChange={handleRegisterWorkerInputChange} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Password</Form.Label><Form.Control type="password" name="password" value={registerWorkerFormData.password} onChange={handleRegisterWorkerInputChange} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Storehouse Name</Form.Label>
                            <Form.Select name="storehouseName" value={registerWorkerFormData.storehouseName} onChange={handleRegisterWorkerInputChange} required disabled={isLoadingStorehouses}>
                                {isLoadingStorehouses ? (<option>Loading...</option>)
                                : storehouseList.length > 0 ? (
                                    <>
                                        <option value="">-- Select a Storehouse --</option>
                                        {storehouseList.map(s => (<option key={s.id} value={s.name}>{s.name}</option>))}
                                    </>
                                ) : (<option value="">No storehouses found</option>)}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Company Business Number</Form.Label><Form.Control type="text" value={businessNumber || ""} readOnly disabled /></Form.Group>
                        <Button variant="primary" type="submit" disabled={isRegisteringWorker || isLoadingStorehouses} className="w-100">{isRegisteringWorker ? <Spinner as="span" size="sm" /> : 'Register Worker'}</Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </div>
    );
}

export default AllWorkers;