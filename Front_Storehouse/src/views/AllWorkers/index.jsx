// src/views/AllWorkers.js (or your path, e.g., index.jsx if that's the actual filename)
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import {
    Table,
    Alert,
    Spinner,
    Badge,
    Button,
    Modal,
    Form,
    Row,
    Col,
    ListGroup,
    Toast,
    ToastContainer
} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

// --- Constants ---
const API_ACCOUNT_BASE_URL = 'https://localhost:7204/api/Account';
const API_CONTRACT_BASE_URL = 'https://localhost:7204/api/WorkContract';

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

function AllWorkers() {
    // --- Main AllWorkers State ---
    const [workers, setWorkers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [businessNumber, setBusinessNumber] = useState(null);

    // --- Contract Modal State & Logic ---
    const [showContractModal, setShowContractModal] = useState(false);
    const [selectedWorkerForContract, setSelectedWorkerForContract] = useState(null);
    const [contractModalMode, setContractModalMode] = useState('view');
    const [currentContractData, setCurrentContractData] = useState(null);
    const [contractFormData, setContractFormData] = useState({
        workContractId: 0, userId: '', startDate: '', endDate: '', salary: '', contractFileUrl: ''
    });
    const [isContractLoading, setIsContractLoading] = useState(false);
    const [contractError, setContractError] = useState(null);
    const [contractSuccessMessage, setContractSuccessMessage] = useState(null);

    // --- Register Worker Modal State & Logic ---
    const [showRegisterWorkerModal, setShowRegisterWorkerModal] = useState(false);
    const [registerWorkerFormData, setRegisterWorkerFormData] = useState({
        username: '', email: '', password: '', storehouseName: ''
    });
    const [isRegisteringWorker, setIsRegisteringWorker] = useState(false);
    const [registerWorkerError, setRegisterWorkerError] = useState(null);
    const [registerWorkerSuccess, setRegisterWorkerSuccess] = useState(null);

    // --- Email Confirmation State ---
    const [confirmingEmailForWorkerId, setConfirmingEmailForWorkerId] = useState(null);

    // --- Assign Role Modal State & Logic ---
    const [showAssignRoleModal, setShowAssignRoleModal] = useState(false);
    const [selectedWorkerForRole, setSelectedWorkerForRole] = useState(null);
    const [roleToAssign, setRoleToAssign] = useState('');
    const [isAssigningRole, setIsAssigningRole] = useState(false);
    const [assignableRolesList, setAssignableRolesList] = useState([]);
    const [isLoadingAssignableRoles, setIsLoadingAssignableRoles] = useState(false);

    const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

    const displayToast = (message, type = 'info') => {
        if (type === 'success') {
            setSuccessMessage(message);
            setError(null);
        } else if (type === 'error') {
            setError(message);
            setSuccessMessage(null);
        }
    };

    const fetchWorkersData = useCallback(async (currentBusinessNumber, currentToken) => {
        setIsLoading(true);
        const API_URL = `${API_ACCOUNT_BASE_URL}/all-workers/${encodeURIComponent(currentBusinessNumber)}`;
        const config = { headers: { Authorization: `Bearer ${currentToken}`, 'Accept': 'application/json' } };
        try {
            const response = await axios.get(API_URL, config);
            setWorkers(response.data);
        } catch (err) {
            console.error("[AllWorkers] Error fetching workers:", err.response || err);
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

    const fetchAssignableRoles = useCallback(async (currentToken) => {
        if (!currentToken) return;
        setIsLoadingAssignableRoles(true);
        try {
            const response = await axios.get(`${API_ACCOUNT_BASE_URL}/assignable-roles`, {
                headers: { Authorization: `Bearer ${currentToken}` }
            });
            setAssignableRolesList(response.data || []);
        } catch (err) {
            console.error("[AllWorkers] Error fetching assignable roles:", err.response || err);
            displayToast("Failed to load assignable roles. Please try again.", 'error');
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
                console.error("Error decoding token:", e);
                displayToast("Invalid or expired token. Please log in again.", 'error'); setIsLoading(false); return;
            }
        } else {
            displayToast("Authentication token not found. Please log in.", 'error'); setIsLoading(false); return;
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
        setContractSuccessMessage(null);
        try {
            const response = await axios.get(`${API_CONTRACT_BASE_URL}/user/${workerId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCurrentContractData(response.data);
            setContractFormData({
                workContractId: response.data.workContractId,
                userId: response.data.userId,
                startDate: response.data.startDate ? new Date(response.data.startDate).toISOString().split('T')[0] : '',
                endDate: response.data.endDate ? new Date(response.data.endDate).toISOString().split('T')[0] : '',
                salary: response.data.salary !== null && response.data.salary !== undefined ? String(response.data.salary) : '',
                contractFileUrl: response.data.contractFileUrl || ''
            });
            setContractModalMode('view');
        } catch (err) {
            if (err.response && err.response.status === 404) {
                setCurrentContractData(null);
                setContractFormData({ workContractId: 0, userId: workerId, startDate: '', endDate: '', salary: '', contractFileUrl: '' });
                setContractModalMode('view');
            } else {
                console.error("[AllWorkers] Error fetching contract details:", err.response || err);
                setContractError(err.response?.data?.message || err.response?.data || "Failed to fetch contract details.");
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
            setIsContractLoading(false);
        }
    }, [showContractModal, selectedWorkerForContract, fetchContractDetailsForModal]);

    const handleShowContractModal = (worker) => {
        setSelectedWorkerForContract(worker);
        setContractError(null);
        setContractSuccessMessage(null);
        setContractModalMode('view');
        setShowContractModal(true);
    };

    const handleCloseContractModal = () => {
        setShowContractModal(false);
        setSelectedWorkerForContract(null);
    };

    const handleContractFormInputChange = (e) => {
        const { name, value } = e.target;
        setContractFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleContractFormSubmit = async (e) => {
        e.preventDefault();
        if (!token) {
            setContractError("Authentication token missing.");
            return;
        }
        setIsContractLoading(true);
        setContractError(null);
        setContractSuccessMessage(null);
        const payload = {
            ...contractFormData,
            userId: contractFormData.userId || selectedWorkerForContract?.id,
            salary: parseFloat(contractFormData.salary) || 0,
        };
        if (contractModalMode === 'create') {
            delete payload.workContractId;
        }
        const url = contractModalMode === 'create'
            ? API_CONTRACT_BASE_URL
            : `${API_CONTRACT_BASE_URL}/${contractFormData.workContractId}`;
        const method = contractModalMode === 'create' ? 'post' : 'put';
        try {
            const response = await axios[method](url, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setContractSuccessMessage(response.data.message || (contractModalMode === 'create' ? "Contract created successfully!" : "Contract updated successfully!"));
            fetchContractDetailsForModal(selectedWorkerForContract.id);
        } catch (err) {
            console.error(`[AllWorkers] Error ${contractModalMode === 'create' ? 'creating' : 'updating'} contract:`, err.response || err);
            setContractError(err.response?.data?.message || err.response?.data?.title || err.response?.data || `Failed to ${contractModalMode} contract.`);
        } finally {
            setIsContractLoading(false);
        }
    };

    const handleDeleteContract = async () => {
        if (!currentContractData || !currentContractData.workContractId) {
            setContractError("No contract selected or contract ID is missing.");
            return;
        }
        if (!window.confirm("Are you sure you want to delete this contract? This action cannot be undone.")) {
            return;
        }
        setIsContractLoading(true);
        setContractError(null);
        setContractSuccessMessage(null);
        try {
            await axios.delete(`${API_CONTRACT_BASE_URL}/${currentContractData.workContractId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setContractSuccessMessage("Contract deleted successfully!");
            setCurrentContractData(null);
            setContractFormData({ workContractId: 0, userId: selectedWorkerForContract?.id || '', startDate: '', endDate: '', salary: '', contractFileUrl: '' });
            setContractModalMode('view');
        } catch (err) {
            console.error("[AllWorkers] Error deleting contract:", err.response || err);
            setContractError(err.response?.data?.message || err.response?.data || "Failed to delete contract.");
        } finally {
            setIsContractLoading(false);
        }
    };

    const openRegisterWorkerModal = () => {
        setRegisterWorkerFormData({ username: '', email: '', password: '', storehouseName: '' });
        setRegisterWorkerError(null);
        setRegisterWorkerSuccess(null);
        setShowRegisterWorkerModal(true);
    };

    const closeRegisterWorkerModal = () => {
        setShowRegisterWorkerModal(false);
    };

    const handleRegisterWorkerInputChange = (e) => {
        const { name, value } = e.target;
        setRegisterWorkerFormData(prevData => ({ ...prevData, [name]: value }));
    };

    const handleRegisterWorkerSubmit = async (e) => {
        e.preventDefault();
        setIsRegisteringWorker(true);
        setRegisterWorkerError(null);
        setRegisterWorkerSuccess(null);
        if (!token) {
            setRegisterWorkerError("Authentication token not found. Please log in again.");
            setIsRegisteringWorker(false);
            return;
        }
        if (!businessNumber) {
            setRegisterWorkerError("Company Business Number is not available. Cannot register worker.");
            setIsRegisteringWorker(false);
            return;
        }
        const payload = { ...registerWorkerFormData, companyBusinessNumber: businessNumber };
        try {
            const response = await axios.post(
                `${API_ACCOUNT_BASE_URL}/register-worker`,
                payload,
                { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );
            setRegisterWorkerSuccess(response.data.message || "Worker registered successfully!");
            displayToast(response.data.message || "Worker registered successfully!", 'success');
            setRegisterWorkerFormData({ username: '', email: '', password: '', storehouseName: '' });
            if (businessNumber && token) {
                fetchWorkersData(businessNumber, token);
            }
        } catch (err) {
            console.error("[AllWorkers] Error registering worker:", err.response || err);
            let errorMessage = "An unexpected error occurred during registration.";
            if (err.response) {
                if (err.response.data) {
                    if (typeof err.response.data === 'string') errorMessage = err.response.data;
                    else if (err.response.data.message) errorMessage = err.response.data.message;
                    else if (err.response.data.errors && Array.isArray(err.response.data.errors)) errorMessage = err.response.data.errors.map(eObj => eObj.description || eObj.code).join('; ');
                    else if (err.response.data.errors && typeof err.response.data.errors === 'object') errorMessage = Object.values(err.response.data.errors).flat().join('; ');
                    else if (err.response.data.title) { errorMessage = err.response.data.title; if (err.response.data.detail) errorMessage += `: ${err.response.data.detail}`; }
                    else { try { errorMessage = JSON.stringify(err.response.data); } catch { errorMessage = `Server responded with status ${err.response.status} but no parsable error message.`; } }
                } else { errorMessage = `Server responded with status ${err.response.status}.`; }
            } else if (err.request) { errorMessage = "Network Error: Could not connect to the server."; }
            else { errorMessage = err.message; }
            setRegisterWorkerError(errorMessage);
            displayToast(errorMessage, 'error');
        } finally {
            setIsRegisteringWorker(false);
        }
    };

    const handleConfirmEmail = async (workerEmail, workerId) => {
        if (!token) {
            displayToast("Authentication token missing.", 'error');
            return;
        }
        setConfirmingEmailForWorkerId(workerId);
        try {
            const payload = { WorkerEmail: workerEmail };
            const response = await axios.post(
                `${API_ACCOUNT_BASE_URL}/confirm-email`,
                payload,
                { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );
            displayToast(response.data.message || "Worker email confirmed successfully.", 'success');
            if (businessNumber && token) {
                fetchWorkersData(businessNumber, token);
            }
        } catch (err) {
            console.error("[AllWorkers] Error confirming email:", err.response || err);
            let errorMessage = "Failed to confirm email.";
            if (err.response && err.response.data) {
                if (typeof err.response.data === 'string') errorMessage = err.response.data;
                else if (err.response.data.message) errorMessage = err.response.data.message;
                else if (err.response.data.errors && Array.isArray(err.response.data.errors)) errorMessage = err.response.data.errors.map(e => e.description || e.code).join('; ');
                else if (err.response.data.title) errorMessage = err.response.data.title;
            } else if (err.response && err.response.status === 404) errorMessage = "Email confirmation service not found. Please check API routes.";
            else if (err.request) errorMessage = "Network error while confirming email.";
            displayToast(errorMessage, 'error');
        } finally {
            setConfirmingEmailForWorkerId(null);
        }
    };

    const openAssignRoleModal = (worker) => {
        setSelectedWorkerForRole(worker);
        if (assignableRolesList.length === 0 && !isLoadingAssignableRoles && token) {
            fetchAssignableRoles(token);
        }
        let defaultRole = '';
        if (worker.role && assignableRolesList.includes(worker.role)) {
            defaultRole = worker.role;
        }
        setRoleToAssign(defaultRole);
        setShowAssignRoleModal(true);
        setError(null);
        setSuccessMessage(null);
    };

    const closeAssignRoleModal = () => {
        setShowAssignRoleModal(false);
        setSelectedWorkerForRole(null);
        setRoleToAssign('');
    };

    const handleRoleToAssignChange = (e) => {
        setRoleToAssign(e.target.value);
    };

    const handleAssignRoleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedWorkerForRole || !roleToAssign) {
            displayToast("Worker or new role not selected, or selected role is invalid.", 'error');
            return;
        }
        if (!token) {
            displayToast("Authentication token not found.", 'error');
            return;
        }
        setIsAssigningRole(true);
        setError(null);
        setSuccessMessage(null);
        const payload = { Username: selectedWorkerForRole.username, Role: roleToAssign };
        const wasUpdatingExistingRole = !!selectedWorkerForRole.role;
        const apiUrl = wasUpdatingExistingRole
            ? `${API_ACCOUNT_BASE_URL}/update-role`
            : `${API_ACCOUNT_BASE_URL}/assign-role`;
        const httpMethod = wasUpdatingExistingRole ? 'put' : 'post';
        try {
            const response = await axios({
                method: httpMethod,
                url: apiUrl,
                data: payload,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            displayToast(response.data.message || `Role ${wasUpdatingExistingRole ? 'updated' : 'assigned'} successfully!`, 'success');
            fetchWorkersData(businessNumber, token);
            closeAssignRoleModal();
        } catch (err) {
            console.error(`[AllWorkers] Error ${wasUpdatingExistingRole ? 'updating' : 'assigning'} role:`, err.response || err);
            let detailedError = `An error occurred while ${wasUpdatingExistingRole ? 'updating' : 'assigning'} role.`;
            if (err.response?.data) {
                if (err.response.data.errors && Array.isArray(err.response.data.errors)) detailedError = err.response.data.errors.map(eObj => eObj.description || eObj.code).join('; ');
                else if (err.response.data.message) detailedError = err.response.data.message;
                else if (typeof err.response.data === 'string') detailedError = err.response.data;
                else detailedError = `Server responded with status ${err.response.status}.`;
            } else if (err.request) detailedError = "Network Error. Could not connect to the server.";
            else detailedError = err.message || "An unknown error occurred.";
            displayToast(detailedError, 'error');
        } finally {
            setIsAssigningRole(false);
        }
    };

    const renderContractViewMode = () => {
        if (!currentContractData) return null;
        return (
            <ListGroup variant="flush">
                <ListGroup.Item><strong>Contract ID:</strong> {currentContractData.workContractId}</ListGroup.Item>
                <ListGroup.Item><strong>User ID:</strong> {currentContractData.userId}</ListGroup.Item>
                <ListGroup.Item><strong>Start Date:</strong> {currentContractData.startDate ? new Date(currentContractData.startDate).toLocaleDateString() : 'N/A'}</ListGroup.Item>
                <ListGroup.Item><strong>End Date:</strong> {currentContractData.endDate ? new Date(currentContractData.endDate).toLocaleDateString() : 'N/A'}</ListGroup.Item>
                <ListGroup.Item><strong>Salary:</strong> {currentContractData.salary ? `$${Number(currentContractData.salary).toLocaleString()}` : 'N/A'}</ListGroup.Item>
                <ListGroup.Item><strong>Document:</strong> {currentContractData.contractFileUrl ? <a href={currentContractData.contractFileUrl} target="_blank" rel="noopener noreferrer">View Document</a> : 'N/A'}</ListGroup.Item>
            </ListGroup>
        );
    };

    const renderContractForm = () => {
        return (
            <Form onSubmit={handleContractFormSubmit}>
                {contractModalMode === 'edit' && <Form.Control type="hidden" name="workContractId" value={contractFormData.workContractId || ''} />}
                <Form.Group as={Row} className="mb-3" controlId="formUserIdModal"><Form.Label column sm={3}>User ID</Form.Label><Col sm={9}><Form.Control type="text" name="userId" value={contractFormData.userId || selectedWorkerForContract?.id || ''} readOnly disabled /></Col></Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="formStartDate"><Form.Label column sm={3}>Start Date</Form.Label><Col sm={9}><Form.Control type="date" name="startDate" value={contractFormData.startDate || ''} onChange={handleContractFormInputChange} required /></Col></Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="formEndDate"><Form.Label column sm={3}>End Date</Form.Label><Col sm={9}><Form.Control type="date" name="endDate" value={contractFormData.endDate || ''} onChange={handleContractFormInputChange} /></Col></Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="formSalary"><Form.Label column sm={3}>Salary</Form.Label><Col sm={9}><Form.Control type="number" step="0.01" name="salary" placeholder="e.g., 50000" value={contractFormData.salary || ''} onChange={handleContractFormInputChange} required /></Col></Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="formContractFileUrl"><Form.Label column sm={3}>Document URL</Form.Label><Col sm={9}><Form.Control type="url" name="contractFileUrl" placeholder="https://example.com/contract.pdf" value={contractFormData.contractFileUrl || ''} onChange={handleContractFormInputChange} /></Col></Form.Group>
                <Button variant="primary" type="submit" disabled={isContractLoading} className="me-2">{isContractLoading ? <Spinner as="span" animation="border" size="sm" /> : (contractModalMode === 'create' ? 'Create Contract' : 'Save Changes')}</Button>
                {contractModalMode === 'edit' && <Button variant="link" onClick={() => { setContractModalMode('view'); if(currentContractData) { setContractFormData({ workContractId: currentContractData.workContractId, userId: currentContractData.userId, startDate: currentContractData.startDate ? new Date(currentContractData.startDate).toISOString().split('T')[0] : '', endDate: currentContractData.endDate ? new Date(currentContractData.endDate).toISOString().split('T')[0] : '', salary: (currentContractData.salary !== null && currentContractData.salary !== undefined) ? String(currentContractData.salary) : '', contractFileUrl: currentContractData.contractFileUrl || '' }); } setContractError(null); setContractSuccessMessage(null); }}>Cancel Edit</Button>}
                {contractModalMode === 'create' && (<Button variant="link" onClick={() => { if (currentContractData && currentContractData.workContractId) { setContractModalMode('view'); setContractFormData({ workContractId: currentContractData.workContractId, userId: currentContractData.userId, startDate: currentContractData.startDate ? new Date(currentContractData.startDate).toISOString().split('T')[0] : '', endDate: currentContractData.endDate ? new Date(currentContractData.endDate).toISOString().split('T')[0] : '', salary: String(currentContractData.salary), contractFileUrl: currentContractData.contractFileUrl || '' }); } else { handleCloseContractModal(); } setContractError(null); setContractSuccessMessage(null); }}>Cancel Create</Button>)}
            </Form>
        );
    };

    if (isLoading && workers.length === 0 && !error && !successMessage) {
        return (<div className="container mt-4 text-center"><Spinner animation="border" /><p>Loading workers...</p></div>);
    }

    return (
        <div className="container mt-4">
            <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1056 }}>
                {successMessage && (<Toast onClose={() => setSuccessMessage(null)} show={!!successMessage} delay={5000} autohide bg="success"><Toast.Header><strong className="me-auto">Success</strong></Toast.Header><Toast.Body className="text-white">{successMessage}</Toast.Body></Toast>)}
                {error && (<Toast onClose={() => setError(null)} show={!!error} delay={5000} autohide bg="danger"><Toast.Header><strong className="me-auto">Error</strong></Toast.Header><Toast.Body className="text-white">{error}</Toast.Body></Toast>)}
            </ToastContainer>

            <Row className="mb-3 align-items-center">
                <Col><h1>Company Workers</h1><p>Business Number: <Badge bg="info">{businessNumber || "N/A"}</Badge></p></Col>
                <Col xs="auto"><Button variant="primary" onClick={openRegisterWorkerModal}>Register New Worker</Button></Col>
            </Row>
            
            {isLoading && workers.length > 0 && <div className="text-center my-2"><Spinner animation="grow" size="sm" /> Refreshing list...</div>}

            {!isLoading && workers.length === 0 && !error && (
                <Alert variant="info">No workers found for this business number.</Alert>
            )}

            {workers.length > 0 && (
                <Table striped bordered hover responsive size="sm">
                    <thead>
                        <tr>
                            <th>#</th><th>Username</th><th>Email</th><th>Status</th><th>Role</th><th>Storehouse</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {workers.map((worker, index) => (
                            <tr key={worker.id}>
                                <td>{index + 1}</td><td>{worker.username}</td><td>{worker.email}</td>
                                <td><Badge bg={worker.emailConfirmed ? 'success' : 'warning'}>{worker.emailConfirmed ? 'Confirmed' : 'Pending'}</Badge></td>
                                <td>
                                    {worker.role ? (
                                        <Badge bg="secondary">{worker.role}</Badge>
                                    ) : (
                                        <Badge bg="light" text="dark">N/A</Badge>
                                    )}
                                </td>
                                <td>{worker.storeHouseName || 'N/A'}</td>
                                <td>
                                    <Button
                                        size="sm"
                                        variant="outline-primary"
                                        className="me-2 mb-1 mb-md-0"
                                        onClick={() => handleShowContractModal(worker)}
                                    >
                                        Manage Contract
                                    </Button>

                                    {!worker.emailConfirmed && (
                                        <Button
                                            size="sm"
                                            variant="outline-success"
                                            className="me-2 mb-1 mb-md-0"
                                            onClick={() => handleConfirmEmail(worker.email, worker.id)}
                                            disabled={confirmingEmailForWorkerId === worker.id}
                                        >
                                            {confirmingEmailForWorkerId === worker.id ? <><Spinner as="span" animation="border" size="sm"/> Confirming...</> : "Confirm Email"}
                                        </Button>
                                    )}

                                    {worker.role ? (
                                        <Button
                                            size="sm"
                                            variant="outline-warning"
                                            className="mb-1 mb-md-0"
                                            onClick={() => openAssignRoleModal(worker)}
                                            disabled={isAssigningRole || isLoadingAssignableRoles || assignableRolesList.length === 0}
                                        >
                                            {isLoadingAssignableRoles ? <><Spinner as="span" animation="border" size="sm"/> Loading...</> : "Update Role"}
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outline-info"
                                            className="mb-1 mb-md-0"
                                            onClick={() => openAssignRoleModal(worker)}
                                            disabled={isAssigningRole || isLoadingAssignableRoles || assignableRolesList.length === 0}
                                        >
                                            {isLoadingAssignableRoles ? <><Spinner as="span" animation="border" size="sm"/> Loading...</> : "Assign Role"}
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}

            {selectedWorkerForContract && (
                <Modal show={showContractModal} onHide={handleCloseContractModal} size="lg" centered backdrop="static">
                    <Modal.Header closeButton>
                        <Modal.Title>
                            Work Contract: {selectedWorkerForContract?.username}
                            {!isContractLoading && (
                                <>
                                    {contractModalMode === 'view' && currentContractData && <Badge bg="secondary" className="ms-2">Viewing</Badge>}
                                    {contractModalMode === 'create' && <Badge bg="success" className="ms-2">Creating New</Badge>}
                                    {contractModalMode === 'edit' && <Badge bg="warning" className="ms-2">Editing</Badge>}
                                    {contractModalMode === 'view' && !currentContractData && !contractError && <Badge bg="info" className="ms-2">No Contract Found</Badge>}
                                </>
                            )}
                            {isContractLoading && <Spinner animation="border" size="sm" className="ms-2" />}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {contractError && <Alert variant="danger" onClose={() => setContractError(null)} dismissible>{contractError}</Alert>}
                        {contractSuccessMessage && <Alert variant="success" onClose={() => setContractSuccessMessage(null)} dismissible>{contractSuccessMessage}</Alert>}
                        {isContractLoading && !contractError && !contractSuccessMessage && (<div className="text-center"><Spinner animation="border" /><p>Processing contract...</p></div>)}
                        {!isContractLoading && (
                            <>
                                {contractModalMode === 'view' && renderContractViewMode()}
                                {(contractModalMode === 'create' || contractModalMode === 'edit') && renderContractForm()}
                                {contractModalMode === 'view' && !currentContractData && !contractError && (
                                    <>
                                        <Alert variant="info" className="mt-3">No contract details available for this worker.</Alert>
                                        <Button variant="success" className="mt-2" onClick={() => { setContractFormData({ workContractId: 0, userId: selectedWorkerForContract.id, startDate: '', endDate: '', salary: '', contractFileUrl: '' }); setCurrentContractData(null); setContractError(null); setContractSuccessMessage(null); setContractModalMode('create'); }}>Create New Contract</Button>
                                    </>
                                )}
                            </>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        {!isContractLoading && contractModalMode === 'view' && currentContractData && (<Button variant="danger" onClick={handleDeleteContract} className="me-auto">Delete Contract</Button>)}
                        {!isContractLoading && contractModalMode === 'view' && currentContractData && (<Button variant="warning" onClick={() => { setContractFormData({ workContractId: currentContractData.workContractId, userId: currentContractData.userId, startDate: currentContractData.startDate ? new Date(currentContractData.startDate).toISOString().split('T')[0] : '', endDate: currentContractData.endDate ? new Date(currentContractData.endDate).toISOString().split('T')[0] : '', salary: (currentContractData.salary !== null && currentContractData.salary !== undefined) ? String(currentContractData.salary) : '', contractFileUrl: currentContractData.contractFileUrl || '' }); setContractModalMode('edit'); setContractError(null); setContractSuccessMessage(null); }}>Edit This Contract</Button>)}
                        <Button variant="secondary" onClick={handleCloseContractModal} disabled={isContractLoading}>Close</Button>
                    </Modal.Footer>
                </Modal>
            )}

            <Modal show={showRegisterWorkerModal} onHide={closeRegisterWorkerModal} centered backdrop="static">
                <Modal.Header closeButton><Modal.Title>Register New Worker</Modal.Title></Modal.Header>
                <Modal.Body>
                    {registerWorkerError && <Alert variant="danger" onClose={() => setRegisterWorkerError(null)} dismissible>{registerWorkerError}</Alert>}
                    {registerWorkerSuccess && <Alert variant="success" onClose={() => { setRegisterWorkerSuccess(null); }}>{registerWorkerSuccess}</Alert>}
                    <Form onSubmit={handleRegisterWorkerSubmit}>
                        <Form.Group className="mb-3" controlId="registerUsername"><Form.Label>Username</Form.Label><Form.Control type="text" name="username" value={registerWorkerFormData.username} onChange={handleRegisterWorkerInputChange} required disabled={isRegisteringWorker}/></Form.Group>
                        <Form.Group className="mb-3" controlId="registerEmail"><Form.Label>Email</Form.Label><Form.Control type="email" name="email" value={registerWorkerFormData.email} onChange={handleRegisterWorkerInputChange} required disabled={isRegisteringWorker}/></Form.Group>
                        <Form.Group className="mb-3" controlId="registerPassword"><Form.Label>Password</Form.Label><Form.Control type="password" name="password" value={registerWorkerFormData.password} onChange={handleRegisterWorkerInputChange} required disabled={isRegisteringWorker}/></Form.Group>
                        <Form.Group className="mb-3" controlId="registerStorehouseName"><Form.Label>Storehouse Name</Form.Label><Form.Control type="text" name="storehouseName" placeholder="Enter exact storehouse name" value={registerWorkerFormData.storehouseName} onChange={handleRegisterWorkerInputChange} required disabled={isRegisteringWorker}/></Form.Group>
                        <Form.Group className="mb-3" controlId="registerCompanyBusinessNumber"><Form.Label>Company Business Number</Form.Label><Form.Control type="text" value={businessNumber || "Loading..."} readOnly disabled /></Form.Group>
                        <Button variant="primary" type="submit" disabled={isRegisteringWorker} className="w-100">{isRegisteringWorker ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Registering...</> : 'Register Worker'}</Button>
                    </Form>
                </Modal.Body>
                <Modal.Footer><Button variant="secondary" onClick={closeRegisterWorkerModal} disabled={isRegisteringWorker}>Close</Button></Modal.Footer>
            </Modal>
            
            {selectedWorkerForRole && (
                <Modal show={showAssignRoleModal} onHide={closeAssignRoleModal} centered backdrop="static">
                    <Modal.Header closeButton>
                        <Modal.Title>
                            {selectedWorkerForRole.role ? "Update Role for: " : "Assign Role to: "}
                            {selectedWorkerForRole.username}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Form onSubmit={handleAssignRoleSubmit}>
                            <Form.Group className="mb-3" controlId="assignRoleUsernameModal">
                                <Form.Label>Worker Username</Form.Label>
                                <Form.Control type="text" value={selectedWorkerForRole.username} readOnly disabled />
                            </Form.Group>
                            <Form.Group className="mb-3" controlId="assignRoleSelectModal">
                                <Form.Label>Select Role</Form.Label>
                                <Form.Select
                                    aria-label="Select role to assign"
                                    value={roleToAssign}
                                    onChange={handleRoleToAssignChange}
                                    disabled={isAssigningRole || isLoadingAssignableRoles || assignableRolesList.length === 0}
                                    required
                                >
                                    {isLoadingAssignableRoles ? (
                                        <option>Loading roles...</option>
                                    ) : assignableRolesList.length === 0 ? (
                                        <option value="">No roles available to assign</option>
                                    ) : (
                                        <>
                                            <option value="">-- Select a Role --</option>
                                            {assignableRolesList.map(r => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </>
                                    )}
                                </Form.Select>
                                {isLoadingAssignableRoles && <Spinner animation="border" size="sm" className="ms-2 mt-2" />}
                            </Form.Group>
                            <Button 
                                variant="primary" 
                                type="submit" 
                                disabled={isAssigningRole || isLoadingAssignableRoles || !roleToAssign || assignableRolesList.length === 0} 
                                className="w-100"
                            >
                                {isAssigningRole ? <><Spinner as="span" animation="border" size="sm" /> Processing...</> : (selectedWorkerForRole.role ? 'Update Role' : 'Assign Role')}
                            </Button>
                        </Form>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={closeAssignRoleModal} disabled={isAssigningRole}>
                            Close
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}
        </div>
    );
}

export default AllWorkers;