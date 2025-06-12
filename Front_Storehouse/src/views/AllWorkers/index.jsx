import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import {
    Table, Alert, Spinner, Badge, Button, Modal, Form, Row, Col, ListGroup, Toast, ToastContainer
} from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

const API_BASE_URL = 'https://localhost:7204/api';
const API_ACCOUNT_URL = `${API_BASE_URL}/Account`;
const API_STOREHOUSES_URL = `${API_BASE_URL}/Storehouses`;
const API_SCHEDULE_URL = `${API_BASE_URL}/Schedule`;
const API_CONTRACT_URL = `${API_BASE_URL}/WorkContract`;

const SESSION_STORAGE_KEYS = { TOKEN: 'authToken' };

function AllWorkers() {
    const [workers, setWorkers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [businessNumber, setBusinessNumber] = useState(null);

    const [showRegisterWorkerModal, setShowRegisterWorkerModal] = useState(false);
    const [registerWorkerFormData, setRegisterWorkerFormData] = useState({ username: '', email: '', password: '', storehouseName: '' });
    const [isRegisteringWorker, setIsRegisteringWorker] = useState(false);
    const [registerWorkerError, setRegisterWorkerError] = useState(null);
    const [registerWorkerSuccess, setRegisterWorkerSuccess] = useState(null);
    const [storehouseList, setStorehouseList] = useState([]);
    const [isLoadingStorehouses, setIsLoadingStorehouses] = useState(false);

    const [confirmingEmailForWorkerId, setConfirmingEmailForWorkerId] = useState(null);

    const [showAssignRoleModal, setShowAssignRoleModal] = useState(false);
    const [selectedWorkerForRole, setSelectedWorkerForRole] = useState(null);
    const [roleToAssign, setRoleToAssign] = useState('');
    const [isAssigningRole, setIsAssigningRole] = useState(false);
    const [assignableRolesList, setAssignableRolesList] = useState([]);
    const [isLoadingAssignableRoles, setIsLoadingAssignableRoles] = useState(false);
    
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedWorkerForSchedule, setSelectedWorkerForSchedule] = useState(null);
    const [scheduleFormData, setScheduleFormData] = useState({ userId: '', startDate: '', endDate: '', breakTime: '' });
    const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);

    const [showContractModal, setShowContractModal] = useState(false);
    const [selectedWorkerForContract, setSelectedWorkerForContract] = useState(null);
    const [contractModalMode, setContractModalMode] = useState('view');
    const [currentContractData, setCurrentContractData] = useState(null);
    const [contractFormData, setContractFormData] = useState({ workContractId: 0, userId: '', startDate: '', endDate: '', salary: '', contractFileUrl: '' });
    const [isContractLoading, setIsContractLoading] = useState(false);
    const [contractError, setContractError] = useState(null);
    const [contractSuccessMessage, setContractSuccessMessage] = useState(null);

    const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

    const displayToast = (message, type = 'success') => {
        if (type === 'success') setSuccessMessage(message);
        else setError(message);
    };

    const fetchWorkersData = useCallback(async (bn, t) => { setIsLoading(true); try { const res = await axios.get(`${API_ACCOUNT_URL}/all-workers/${encodeURIComponent(bn)}`, { headers: { Authorization: `Bearer ${t}` } }); setWorkers(res.data); } catch (e) { setError(e.response?.data?.message || "Error fetching workers."); } finally { setIsLoading(false); } }, []);
    const fetchStorehouses = useCallback(async () => { setIsLoadingStorehouses(true); try { const res = await axios.get(`${API_STOREHOUSES_URL}/for-dropdown`, { headers: { Authorization: `Bearer ${token}` } }); setStorehouseList(res.data || []); } catch (e) { displayToast("Failed to load storehouses.", 'error'); } finally { setIsLoadingStorehouses(false); } }, [token]);
    const fetchAssignableRoles = useCallback(async (t) => { setIsLoadingAssignableRoles(true); try { const res = await axios.get(`${API_ACCOUNT_URL}/assignable-roles`, { headers: { Authorization: `Bearer ${t}` } }); setAssignableRolesList(res.data || []); } catch (e) { displayToast("Failed to load roles.", 'error'); } finally { setIsLoadingAssignableRoles(false); } }, []);
    const fetchContractDetailsForModal = useCallback(async (workerId) => { setIsContractLoading(true); setContractError(null); try { const res = await axios.get(`${API_CONTRACT_URL}/user/${workerId}`, { headers: { Authorization: `Bearer ${token}` } }); setCurrentContractData(res.data); setContractFormData({ workContractId: res.data.workContractId, userId: res.data.userId, startDate: res.data.startDate ? new Date(res.data.startDate).toISOString().split('T')[0] : '', endDate: res.data.endDate ? new Date(res.data.endDate).toISOString().split('T')[0] : '', salary: String(res.data.salary || ''), contractFileUrl: res.data.contractFileUrl || '' }); setContractModalMode('view'); } catch (err) { if (err.response?.status === 404) { setCurrentContractData(null); setContractModalMode('create'); } else { setContractError(err.response?.data?.message || 'Failed to fetch contract.'); } } finally { setIsContractLoading(false); } }, [token]);

    useEffect(() => {
        if (token) {
            try {
                const decoded = jwtDecode(token);
                const bn = decoded.CompanyBusinessNumber;
                const role = decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
                if (role?.toLowerCase() !== 'companymanager') { setError("Access Denied."); setIsLoading(false); return; }
                if (bn) { setBusinessNumber(bn); fetchWorkersData(bn, token); fetchAssignableRoles(token); } 
                else { setError("Business Number not in token."); setIsLoading(false); }
            } catch (e) { setError("Invalid token."); setIsLoading(false); }
        } else { setError("Not authenticated."); setIsLoading(false); }
    }, [token, fetchWorkersData, fetchAssignableRoles]);
    
    const openRegisterWorkerModal = () => { setRegisterWorkerFormData({ username: '', email: '', password: '', storehouseName: '' }); setRegisterWorkerError(null); setRegisterWorkerSuccess(null); fetchStorehouses(); setShowRegisterWorkerModal(true); };
    const closeRegisterWorkerModal = () => setShowRegisterWorkerModal(false);
    const handleRegisterWorkerInputChange = (e) => setRegisterWorkerFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    const handleRegisterWorkerSubmit = async (e) => { e.preventDefault(); setIsRegisteringWorker(true); setRegisterWorkerError(null); try { const res = await axios.post(`${API_ACCOUNT_URL}/register-worker`, { ...registerWorkerFormData, CompanyBusinessNumber: businessNumber }, { headers: { Authorization: `Bearer ${token}` } }); setRegisterWorkerSuccess(res.data.message || "Worker registered!"); fetchWorkersData(businessNumber, token); setTimeout(closeRegisterWorkerModal, 2000); } catch (err) { const d = err.response?.data; setRegisterWorkerError(typeof d === 'string' ? d : d?.message || Object.values(d?.errors || {}).flat().join(' ')); } finally { setIsRegisteringWorker(false); } };
    
    const handleConfirmEmail = async (workerEmail, workerId) => {
        setConfirmingEmailForWorkerId(workerId);
        try {
            await axios.post(`${API_ACCOUNT_URL}/confirm-email`, { WorkerEmail: workerEmail }, { headers: { Authorization: `Bearer ${token}` } });
            setWorkers(currentWorkers =>
                currentWorkers.map(worker =>
                    worker.id === workerId ? { ...worker, emailConfirmed: true } : worker
                )
            );
            displayToast("Email confirmed successfully.", 'success');
        } catch (err) {
            displayToast(err.response?.data?.message || "Failed to confirm email.", 'error');
        } finally {
            setConfirmingEmailForWorkerId(null);
        }
    };

    const openAssignRoleModal = (w) => { setSelectedWorkerForRole(w); setRoleToAssign(w.role || ''); setShowAssignRoleModal(true); };
    const closeAssignRoleModal = () => setShowAssignRoleModal(false);
    const handleRoleToAssignChange = (e) => setRoleToAssign(e.target.value);
    const handleAssignRoleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedWorkerForRole || !roleToAssign) return;
        setIsAssigningRole(true);
        try {
            const url = selectedWorkerForRole.role ? `${API_ACCOUNT_URL}/update-role` : `${API_ACCOUNT_URL}/assign-role`;
            await axios({ method: selectedWorkerForRole.role ? 'put' : 'post', url, data: { Username: selectedWorkerForRole.username, Role: roleToAssign }, headers: { Authorization: `Bearer ${token}` } });
            setWorkers(currentWorkers =>
                currentWorkers.map(worker =>
                    worker.id === selectedWorkerForRole.id ? { ...worker, role: roleToAssign } : worker
                )
            );
            displayToast("Role updated.", 'success');
            closeAssignRoleModal();
        } catch (err) {
            displayToast(err.response?.data?.message || "Failed to update role.", 'error');
        } finally {
            setIsAssigningRole(false);
        }
    };

    const openScheduleModal = (w) => { setSelectedWorkerForSchedule(w); setScheduleFormData({ userId: w.id, startDate: '', endDate: '', breakTime: '' }); setShowScheduleModal(true); };
    const closeScheduleModal = () => setShowScheduleModal(false);
    const handleScheduleFormChange = (e) => setScheduleFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    const handleScheduleSubmit = async (e) => { e.preventDefault(); setIsCreatingSchedule(true); try { await axios.post(API_SCHEDULE_URL, { ...scheduleFormData }, { headers: { Authorization: `Bearer ${token}` } }); displayToast("Schedule created!", 'success'); closeScheduleModal(); } catch (err) { displayToast(err.response?.data?.title || "Failed to create schedule.", 'error'); } finally { setIsCreatingSchedule(false); } };

    const handleShowContractModal = (w) => { setSelectedWorkerForContract(w); setContractFormData({ userId: w.id, startDate: '', endDate: '', salary: '', contractFileUrl: '' }); setShowContractModal(true); fetchContractDetailsForModal(w.id); };
    const handleCloseContractModal = () => { setShowContractModal(false); setSelectedWorkerForContract(null); setCurrentContractData(null); setContractError(null); setContractSuccessMessage(null); };
    const handleContractFormInputChange = (e) => setContractFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    const handleContractFormSubmit = async (e) => { e.preventDefault(); setIsContractLoading(true); setContractError(null); try { const payload = { ...contractFormData, salary: parseFloat(contractFormData.salary) || 0, userId: selectedWorkerForContract.id }; if (contractModalMode === 'create') { await axios.post(API_CONTRACT_URL, payload, { headers: { Authorization: `Bearer ${token}` } }); } else { await axios.put(`${API_CONTRACT_URL}/${payload.workContractId}`, payload, { headers: { Authorization: `Bearer ${token}` } }); } setContractSuccessMessage(`Contract ${contractModalMode}d successfully!`); fetchContractDetailsForModal(selectedWorkerForContract.id); } catch (err) { setContractError(err.response?.data?.message || `Failed to ${contractModalMode} contract.`); } finally { setIsContractLoading(false); } };
    const handleDeleteContract = async () => { if (!currentContractData?.workContractId || !window.confirm("Delete this contract?")) return; setIsContractLoading(true); setContractError(null); try { await axios.delete(`${API_CONTRACT_URL}/${currentContractData.workContractId}`, { headers: { Authorization: `Bearer ${token}` } }); setContractSuccessMessage('Contract deleted.'); setCurrentContractData(null); setContractModalMode('create'); } catch (err) { setContractError(err.response?.data?.message || 'Failed to delete.'); } finally { setIsContractLoading(false); } };
    
    return (
        <div className="container mt-4">
            <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1060 }}>
                {successMessage && (<Toast onClose={() => setSuccessMessage(null)} show={!!successMessage} delay={3000} autohide bg="success"><Toast.Header closeButton={false}><strong className="me-auto">Success</strong></Toast.Header><Toast.Body className="text-white">{successMessage}</Toast.Body></Toast>)}
                {error && (<Toast onClose={() => setError(null)} show={!!error} delay={5000} autohide bg="danger"><Toast.Header closeButton={false}><strong className="me-auto">Error</strong></Toast.Header><Toast.Body className="text-white">{error}</Toast.Body></Toast>)}
            </ToastContainer>

            <Row className="mb-3 align-items-center">
                <Col><h1>Company Workers</h1></Col>
                <Col xs="auto"><Button variant="primary" onClick={openRegisterWorkerModal}>Register New Worker</Button></Col>
            </Row>

            {isLoading ? (<div className="text-center my-4"><Spinner animation="border" /></div>)
                : error && workers.length === 0 ? (<Alert variant="danger">{error}</Alert>)
                : workers.length > 0 ? (
                    <Table striped bordered hover responsive size="sm">
                        <thead><tr><th>Username</th><th>Email</th><th>Status</th><th>Role</th><th>Storehouse</th><th>Actions</th></tr></thead>
                        <tbody>
                            {workers.map((worker) => (
                                <tr key={worker.id}>
                                    <td>{worker.username}</td>
                                    <td>{worker.email}</td>
                                    <td><Badge bg={worker.emailConfirmed ? 'success' : 'warning'}>{worker.emailConfirmed ? 'Confirmed' : 'Pending'}</Badge></td>
                                    <td>{worker.role ? <Badge bg="info">{worker.role}</Badge> : <Badge bg="light" text="dark">N/A</Badge>}</td>
                                    <td>{worker.storeHouseName || 'N/A'}</td>
                                    <td className="d-flex flex-wrap" style={{ gap: '0.5rem' }}>
                                        {!worker.emailConfirmed && (<Button size="sm" variant="outline-success" onClick={() => handleConfirmEmail(worker.email, worker.id)} disabled={confirmingEmailForWorkerId === worker.id}>{confirmingEmailForWorkerId === worker.id ? <Spinner as="span" size="sm" /> : "Confirm"}</Button>)}
                                        <Button size="sm" variant="outline-secondary" onClick={() => openAssignRoleModal(worker)}>{worker.role ? 'Update Role' : 'Assign Role'}</Button>
                                        <Button size="sm" variant="outline-primary" onClick={() => openScheduleModal(worker)}>Schedule</Button>
                                        <Button size="sm" variant="outline-info" onClick={() => handleShowContractModal(worker)}>Manage Contract</Button>
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
                        <Form.Group className="mb-3"><Form.Label>Storehouse</Form.Label>
                            <Form.Select name="storehouseName" value={registerWorkerFormData.storehouseName} onChange={handleRegisterWorkerInputChange} required disabled={isLoadingStorehouses}>
                                {isLoadingStorehouses ? (<option>Loading...</option>) : (<><option value="">-- Select --</option>{storehouseList.map(s => (<option key={s.id} value={s.name}>{s.name}</option>))}</>)}
                            </Form.Select>
                        </Form.Group>
                        <Button variant="primary" type="submit" disabled={isRegisteringWorker || isLoadingStorehouses} className="w-100">{isRegisteringWorker ? <Spinner as="span" size="sm" /> : 'Register'}</Button>
                    </Form>
                </Modal.Body>
            </Modal>

            <Modal show={showAssignRoleModal} onHide={closeAssignRoleModal} centered>
                <Modal.Header closeButton><Modal.Title>Role for <strong>{selectedWorkerForRole?.username}</strong></Modal.Title></Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleAssignRoleSubmit}>
                        <Form.Group className="mb-3"><Form.Label>Select Role</Form.Label>
                            <Form.Select value={roleToAssign} onChange={handleRoleToAssignChange} disabled={isLoadingAssignableRoles || isAssigningRole} required>
                                {isLoadingAssignableRoles ? (<option>Loading...</option>) : (<><option value="">-- Select --</option>{assignableRolesList.map(r => (<option key={r} value={r}>{r}</option>))}</>)}
                            </Form.Select>
                        </Form.Group>
                        <Button variant="primary" type="submit" disabled={isAssigningRole || isLoadingAssignableRoles || !roleToAssign} className="w-100">{isAssigningRole ? <Spinner as="span" size="sm" /> : 'Update Role'}</Button>
                    </Form>
                </Modal.Body>
            </Modal>

            <Modal show={showScheduleModal} onHide={closeScheduleModal} centered>
                <Modal.Header closeButton><Modal.Title>Schedule for <strong>{selectedWorkerForSchedule?.username}</strong></Modal.Title></Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleScheduleSubmit}>
                        <Form.Group className="mb-3"><Form.Label>Start Time</Form.Label><Form.Control type="time" name="startDate" value={scheduleFormData.startDate} onChange={handleScheduleFormChange} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>End Time</Form.Label><Form.Control type="time" name="endDate" value={scheduleFormData.endDate} onChange={handleScheduleFormChange} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Break Time</Form.Label><Form.Control type="text" name="breakTime" value={scheduleFormData.breakTime} onChange={handleScheduleFormChange} placeholder="e.g., 12:00-12:30" required /></Form.Group>
                        <Button variant="primary" type="submit" disabled={isCreatingSchedule} className="w-100">{isCreatingSchedule ? <Spinner as="span" size="sm" /> : 'Save'}</Button>
                    </Form>
                </Modal.Body>
            </Modal>
            
            <Modal show={showContractModal} onHide={handleCloseContractModal} size="lg" centered>
                <Modal.Header closeButton><Modal.Title>Contract: {selectedWorkerForContract?.username}</Modal.Title></Modal.Header>
                <Modal.Body>
                    {isContractLoading && <div className="text-center"><Spinner /></div>}
                    {contractError && <Alert variant="danger" onClose={() => setContractError(null)} dismissible>{contractError}</Alert>}
                    {contractSuccessMessage && <Alert variant="success" onClose={() => setContractSuccessMessage(null)} dismissible>{contractSuccessMessage}</Alert>}
                    {!isContractLoading && (
                        <>
                            {contractModalMode === 'view' && currentContractData && (
                                <ListGroup variant="flush">
                                    <ListGroup.Item><strong>Start:</strong> {new Date(currentContractData.startDate).toLocaleDateString()}</ListGroup.Item>
                                    <ListGroup.Item><strong>End:</strong> {currentContractData.endDate ? new Date(currentContractData.endDate).toLocaleDateString() : 'Active'}</ListGroup.Item>
                                    <ListGroup.Item><strong>Salary:</strong> ${Number(currentContractData.salary).toLocaleString()}</ListGroup.Item>
                                    <ListGroup.Item><strong>Document:</strong> {currentContractData.contractFileUrl ? <a href={currentContractData.contractFileUrl} target="_blank" rel="noopener noreferrer">View</a> : 'N/A'}</ListGroup.Item>
                                </ListGroup>
                            )}
                            {(contractModalMode === 'create' || contractModalMode === 'edit') && (
                                <Form onSubmit={handleContractFormSubmit}>
                                    <Form.Group className="mb-3"><Form.Label>Start Date</Form.Label><Form.Control type="date" name="startDate" value={contractFormData.startDate} onChange={handleContractFormInputChange} required /></Form.Group>
                                    <Form.Group className="mb-3"><Form.Label>End Date</Form.Label><Form.Control type="date" name="endDate" value={contractFormData.endDate} onChange={handleContractFormInputChange} /></Form.Group>
                                    <Form.Group className="mb-3"><Form.Label>Salary</Form.Label><Form.Control type="number" step="0.01" name="salary" placeholder="50000" value={contractFormData.salary} onChange={handleContractFormInputChange} required /></Form.Group>
                                    <Form.Group className="mb-3"><Form.Label>Document URL</Form.Label><Form.Control type="url" name="contractFileUrl" placeholder="https://example.com/doc.pdf" value={contractFormData.contractFileUrl} onChange={handleContractFormInputChange} /></Form.Group>
                                    <Button variant="primary" type="submit" disabled={isContractLoading}>{contractModalMode === 'create' ? 'Create' : 'Save Changes'}</Button>
                                </Form>
                            )}
                            {contractModalMode === 'view' && !currentContractData && !contractError && (<div className="text-center mt-3"><Alert variant="info">No contract exists.</Alert><Button variant="success" onClick={() => setContractModalMode('create')}>Create Contract</Button></div>)}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    {!isContractLoading && contractModalMode === 'view' && currentContractData && (<><Button variant="danger" className="me-auto" onClick={handleDeleteContract}>Delete</Button><Button variant="warning" onClick={() => setContractModalMode('edit')}>Edit</Button></>)}
                    {!isContractLoading && (contractModalMode === 'edit' || (contractModalMode === 'create' && currentContractData)) && (<Button variant="secondary" onClick={() => { setContractModalMode('view'); setContractError(null); }}>Cancel</Button>)}
                    <Button variant="secondary" onClick={handleCloseContractModal}>Close</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default AllWorkers;