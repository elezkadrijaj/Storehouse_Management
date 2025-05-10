// src/views/AllWorkers.js (or your path)
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
    ListGroup
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
    const [isLoading, setIsLoading] = useState(true); // Main page loading
    const [error, setError] = useState(null); // Main page error
    const [businessNumber, setBusinessNumber] = useState(null);

    // --- Contract Modal State & Logic ---
    const [showContractModal, setShowContractModal] = useState(false);
    const [selectedWorkerForContract, setSelectedWorkerForContract] = useState(null);
    const [contractModalMode, setContractModalMode] = useState('view'); // 'view', 'create', 'edit'
    const [currentContractData, setCurrentContractData] = useState(null); // Data for viewing contract
    const [contractFormData, setContractFormData] = useState({ // Data for form (create/edit)
        workContractId: 0,
        userId: '',
        startDate: '',
        endDate: '',
        salary: '',
        contractFileUrl: ''
    });
    const [isContractLoading, setIsContractLoading] = useState(false); // Loading state for contract details within modal
    const [contractError, setContractError] = useState(null); // Error specific to contract operations in modal
    const [contractSuccessMessage, setContractSuccessMessage] = useState(null); // Success message for contract operations

    const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

    // --- Fetch Workers Data ---
    const fetchWorkersData = useCallback(async (currentBusinessNumber, currentToken) => {
        console.log("[AllWorkers] fetchWorkersData called with BN:", currentBusinessNumber);
        setIsLoading(true);
        setError(null);
        const API_URL = `${API_ACCOUNT_BASE_URL}/all-workers/${encodeURIComponent(currentBusinessNumber)}`;
        const config = { headers: { Authorization: `Bearer ${currentToken}`, 'Accept': 'application/json' } };
        try {
            const response = await axios.get(API_URL, config);
            console.log("[AllWorkers] Fetched workers:", response.data);
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
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // --- Initial useEffect for Token, Role, and Initial Worker Fetch ---
    useEffect(() => {
        console.log("[AllWorkers] Initial useEffect triggered. Token:", token ? "Present" : "Absent");
        let decodedToken, extractedBusinessNumber, extractedRole;
        if (token) {
            try {
                decodedToken = jwtDecode(token);
                extractedBusinessNumber = decodedToken.CompanyBusinessNumber;
                setBusinessNumber(extractedBusinessNumber);
                const roleClaimName = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
                extractedRole = decodedToken[roleClaimName];
                console.log("[AllWorkers] Extracted BN:", extractedBusinessNumber, "Role:", extractedRole);
            } catch (e) {
                console.error("[AllWorkers] Token decoding error:", e);
                setError("Invalid or expired token. Please log in again.");
                setIsLoading(false); return;
            }
        } else {
            setError("Authentication token not found. Please log in.");
            setIsLoading(false); return;
        }

        if (extractedRole?.toLowerCase() !== 'companymanager') {
            setError("Access Denied: Company Manager role required to view this page.");
            setIsLoading(false); return;
        }
        if (!extractedBusinessNumber) {
            setError("Company Business Number not found in token. Cannot fetch workers.");
            setIsLoading(false); return;
        }
        fetchWorkersData(extractedBusinessNumber, token);
    }, [token, fetchWorkersData]);


    const fetchContractDetailsForModal = useCallback(async (workerId) => {
        if (!workerId || !token) {
            setIsContractLoading(false);
            return;
        }
        console.log(`[AllWorkers] fetchContractDetailsForModal: Fetching for workerId ${workerId}`);
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
                salary: (response.data.salary !== null && response.data.salary !== undefined) ? String(response.data.salary) : '',
                contractFileUrl: response.data.contractFileUrl || ''
            });
            setContractModalMode('view');
        } catch (err) {
            console.error("[AllWorkers] fetchContractDetailsForModal: Error fetching contract details:", err.response || err);
            if (err.response && err.response.status === 404) {
                setCurrentContractData(null);
                setContractModalMode('create'); // If no contract, prime for creation
                 setContractFormData({ // Reset form for new creation, pre-filling UserId
                    workContractId: 0,
                    userId: workerId, // Set the workerId here
                    startDate: '',
                    endDate: '',
                    salary: '',
                    contractFileUrl: ''
                });
            } else {
                setContractError(err.response?.data?.message || 'Failed to fetch contract details.');
                setCurrentContractData(null);
                setContractModalMode('view'); // Stay in view to show the error
            }
        } finally {
            setIsContractLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (showContractModal && selectedWorkerForContract) {
            setIsContractLoading(true);
            setContractModalMode('view'); // Default to view, fetch will adjust if needed
            setContractError(null);
            setContractSuccessMessage(null);
            setCurrentContractData(null);
            // Initial form data, especially userId, fetchContractDetailsForModal will override if contract exists
            // or set it to 'create' mode with this userId if no contract.
            setContractFormData({
                workContractId: 0,
                userId: selectedWorkerForContract.id,
                startDate: '',
                endDate: '',
                salary: '',
                contractFileUrl: ''
            });
            fetchContractDetailsForModal(selectedWorkerForContract.id);
        } else if (!showContractModal) {
            setIsContractLoading(false);
        }
    }, [showContractModal, selectedWorkerForContract, fetchContractDetailsForModal]);


    const handleShowContractModal = (worker) => {
        setSelectedWorkerForContract(worker);
        setShowContractModal(true);
    };

    const handleCloseContractModal = () => {
        setShowContractModal(false);
        setSelectedWorkerForContract(null);
        // Refresh worker list if a contract operation might have changed status
        if (businessNumber && token && (contractSuccessMessage || (contractError && contractError.includes("deleted")))) { // also refresh if error indicates it was deleted
            fetchWorkersData(businessNumber, token);
        }
        setContractSuccessMessage(null);
        setContractError(null);
        setCurrentContractData(null);
        setContractFormData({ workContractId: 0, userId: '', startDate: '', endDate: '', salary: '', contractFileUrl: '' });
        setIsContractLoading(false);
        setContractModalMode('view');
    };

    const handleContractFormInputChange = (e) => {
        const { name, value } = e.target;
        setContractFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleContractFormSubmit = async (e) => {
        e.preventDefault();
        setIsContractLoading(true);
        setContractError(null);
        setContractSuccessMessage(null);

        if (!selectedWorkerForContract || !selectedWorkerForContract.id) {
            setContractError("No worker selected or worker ID is missing.");
            setIsContractLoading(false); return;
        }
        if (contractModalMode === 'edit' && (!contractFormData.workContractId || contractFormData.workContractId === 0)) {
            setContractError("Contract ID is missing for update.");
            setIsContractLoading(false); return;
        }

        const payload = {
            ...contractFormData,
            salary: parseFloat(contractFormData.salary) || 0,
            userId: selectedWorkerForContract.id
        };
        if (payload.startDate === '') payload.startDate = null;
        if (payload.endDate === '') payload.endDate = null;

        try {
            if (contractModalMode === 'create') {
                const createPayload = { ...payload };
                if ('workContractId' in createPayload && (createPayload.workContractId === 0 || !createPayload.workContractId)) {
                    delete createPayload.workContractId;
                }
                const response = await axios.post(API_CONTRACT_BASE_URL, createPayload, { headers: { Authorization: `Bearer ${token}` } });
                setContractSuccessMessage('Contract created successfully!');
                setCurrentContractData(response.data);
                setContractFormData({
                    workContractId: response.data.workContractId,
                    userId: response.data.userId,
                    startDate: response.data.startDate ? new Date(response.data.startDate).toISOString().split('T')[0] : '',
                    endDate: response.data.endDate ? new Date(response.data.endDate).toISOString().split('T')[0] : '',
                    salary: (response.data.salary !== null && response.data.salary !== undefined) ? String(response.data.salary) : '',
                    contractFileUrl: response.data.contractFileUrl || ''
                });
                setContractModalMode('view');
            } else if (contractModalMode === 'edit') {
                const putUrl = `${API_CONTRACT_BASE_URL}/${payload.workContractId}`;
                await axios.put(putUrl, payload, { headers: { Authorization: `Bearer ${token}` } });
                setContractSuccessMessage('Contract updated successfully!');
                const newCurrentContractData = { ...payload, salary: parseFloat(payload.salary) }; // Ensure salary is number
                setCurrentContractData(newCurrentContractData);
                setContractFormData({ // Update form data to reflect saved state
                    workContractId: newCurrentContractData.workContractId,
                    userId: newCurrentContractData.userId,
                    startDate: newCurrentContractData.startDate ? new Date(newCurrentContractData.startDate).toISOString().split('T')[0] : '',
                    endDate: newCurrentContractData.endDate ? new Date(newCurrentContractData.endDate).toISOString().split('T')[0] : '',
                    salary: String(newCurrentContractData.salary),
                    contractFileUrl: newCurrentContractData.contractFileUrl || ''
                });
                setContractModalMode('view');
            }
        } catch (err) {
            console.error(`[AllWorkers] Error during ${contractModalMode} contract:`, err.response || err);
            let detailedError = `An error occurred.`;
            if (err.response?.data) {
                if (typeof err.response.data === 'string') { detailedError = err.response.data; }
                else if (err.response.data.errors) { detailedError = Object.values(err.response.data.errors).flat().join(' '); }
                else if (err.response.data.message || err.response.data.title) { detailedError = err.response.data.message || err.response.data.title; }
                else { detailedError = `Server responded with status ${err.response.status}`; }
            } else if (err.request) { detailedError = "Network Error."; }
            else if (err.message) { detailedError = err.message; }
            setContractError(detailedError);
        } finally {
            setIsContractLoading(false);
        }
    };

    // --- NEW: handleDeleteContract function ---
    const handleDeleteContract = async () => {
        if (!currentContractData || !currentContractData.workContractId) {
            console.error("[AllWorkers] Delete Error: No contract data or contract ID available for deletion.");
            setContractError("Cannot delete: contract details are missing.");
            return;
        }
        if (!token) {
            setContractError("Authentication token not found. Cannot delete contract.");
            return;
        }
        if (!selectedWorkerForContract || !selectedWorkerForContract.id) {
             setContractError("Cannot delete: worker information is missing."); // Should not happen if modal is open for a worker
            return;
        }

        // Optional: Confirmation dialog (using window.confirm for simplicity)
        if (!window.confirm("Are you sure you want to delete this contract? This action cannot be undone.")) {
            return;
        }

        console.log(`[AllWorkers] handleDeleteContract called for WorkContractId: ${currentContractData.workContractId}`);
        setIsContractLoading(true);
        setContractError(null);
        setContractSuccessMessage(null);

        try {
            const deleteUrl = `${API_CONTRACT_BASE_URL}/${currentContractData.workContractId}`;
            console.log("[AllWorkers] DELETing to:", deleteUrl);
            await axios.delete(deleteUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log("[AllWorkers] Delete success.");
            setContractSuccessMessage('Contract deleted successfully. You can now create a new one.');
            setCurrentContractData(null); // Clear the viewed/deleted contract
            
            setContractModalMode('create'); // Switch to create mode
            setContractFormData({ // Reset form for new creation, pre-filling UserId
                workContractId: 0,
                userId: selectedWorkerForContract.id, // Use the ID of the worker for whom the modal is open
                startDate: '',
                endDate: '',
                salary: '',
                contractFileUrl: ''
            });
        } catch (err) {
            console.error("[AllWorkers] Error deleting contract:", err.response || err);
            let detailedError = "An error occurred while deleting the contract.";
            if (err.response?.data) {
                if (typeof err.response.data === 'string') { detailedError = err.response.data; }
                else if (err.response.data.message || err.response.data.title) { detailedError = err.response.data.message || err.response.data.title; }
                else { detailedError = `Server responded with status ${err.response.status}: ${JSON.stringify(err.response.data)}`; }
            } else if (err.request) { detailedError = "Network Error: Could not connect to the server."; }
            else if (err.message) { detailedError = err.message; }
            
            if (err.response && err.response.status === 404) {
                // If contract was already gone, treat as a success for user's goal
                setContractSuccessMessage('Contract was already deleted or not found. You can create a new one.');
                setCurrentContractData(null);
                setContractModalMode('create');
                 setContractFormData({
                    workContractId: 0,
                    userId: selectedWorkerForContract.id,
                    startDate: '',
                    endDate: '',
                    salary: '',
                    contractFileUrl: ''
                });
            } else {
                setContractError(detailedError);
                // Keep modalMode as 'view' to show the error with the existing (failed to delete) contract details.
            }
        } finally {
            setIsContractLoading(false);
            console.log("[AllWorkers] handleDeleteContract finished. isContractLoading: false");
        }
    };


    const renderContractViewMode = () => {
        if (!currentContractData) {
            if (!contractError) { // If no error, and no data, means it's create mode or no contract exists
                return null; // "Create new contract" button will be handled outside if appropriate
            }
            return null; // Error will be displayed by the parent
        }
        return (
            <ListGroup variant="flush">
                <ListGroup.Item><strong>Contract ID:</strong> {currentContractData.workContractId}</ListGroup.Item>
                <ListGroup.Item><strong>User ID:</strong> {currentContractData.userId}</ListGroup.Item>
                <ListGroup.Item><strong>Start Date:</strong> {currentContractData.startDate ? new Date(currentContractData.startDate).toLocaleDateString() : 'N/A'}</ListGroup.Item>
                <ListGroup.Item><strong>End Date:</strong> {currentContractData.endDate ? new Date(currentContractData.endDate).toLocaleDateString() : 'N/A'}</ListGroup.Item>
                <ListGroup.Item><strong>Salary:</strong> {currentContractData.salary ? `$${Number(currentContractData.salary).toLocaleString()}` : 'N/A'}</ListGroup.Item>
                <ListGroup.Item>
                    <strong>Document:</strong> {currentContractData.contractFileUrl ?
                        <a href={currentContractData.contractFileUrl} target="_blank" rel="noopener noreferrer">View Document</a> : 'N/A'}
                </ListGroup.Item>
            </ListGroup>
        );
    }

    const renderContractForm = () => {
        return (
            <Form onSubmit={handleContractFormSubmit}>
                {contractModalMode === 'edit' && <Form.Control type="hidden" name="workContractId" value={contractFormData.workContractId || ''} />}
                <Form.Group as={Row} className="mb-3" controlId="formUserIdModal">
                    <Form.Label column sm={3}>User ID</Form.Label>
                    <Col sm={9}><Form.Control type="text" name="userId" value={contractFormData.userId || selectedWorkerForContract?.id || ''} readOnly disabled /></Col>
                </Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="formStartDate">
                    <Form.Label column sm={3}>Start Date</Form.Label>
                    <Col sm={9}><Form.Control type="date" name="startDate" value={contractFormData.startDate || ''} onChange={handleContractFormInputChange} required /></Col>
                </Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="formEndDate">
                    <Form.Label column sm={3}>End Date</Form.Label>
                    <Col sm={9}><Form.Control type="date" name="endDate" value={contractFormData.endDate || ''} onChange={handleContractFormInputChange} /></Col>
                </Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="formSalary">
                    <Form.Label column sm={3}>Salary</Form.Label>
                    <Col sm={9}><Form.Control type="number" step="0.01" name="salary" placeholder="e.g., 50000" value={contractFormData.salary || ''} onChange={handleContractFormInputChange} required /></Col>
                </Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="formContractFileUrl">
                    <Form.Label column sm={3}>Document URL</Form.Label>
                    <Col sm={9}><Form.Control type="url" name="contractFileUrl" placeholder="https://example.com/contract.pdf" value={contractFormData.contractFileUrl || ''} onChange={handleContractFormInputChange} /></Col>
                </Form.Group>
                <Button variant="primary" type="submit" disabled={isContractLoading} className="me-2">
                    {isContractLoading ? <Spinner as="span" animation="border" size="sm" /> : (contractModalMode === 'create' ? 'Create Contract' : 'Save Changes')}
                </Button>
                {contractModalMode === 'edit' && <Button variant="link" onClick={() => {
                    setContractModalMode('view');
                    if(currentContractData) { // Revert form to current viewed data
                         setContractFormData({
                            workContractId: currentContractData.workContractId,
                            userId: currentContractData.userId,
                            startDate: currentContractData.startDate ? new Date(currentContractData.startDate).toISOString().split('T')[0] : '',
                            endDate: currentContractData.endDate ? new Date(currentContractData.endDate).toISOString().split('T')[0] : '',
                            salary: (currentContractData.salary !== null && currentContractData.salary !== undefined) ? String(currentContractData.salary) : '',
                            contractFileUrl: currentContractData.contractFileUrl || ''
                        });
                    }
                    setContractError(null); setContractSuccessMessage(null);
                }}>Cancel Edit</Button>}
                 {contractModalMode === 'create' && ( // Cancel create button
                    <Button variant="link" onClick={() => {
                        // If there was a contract before we switched to 'create' (e.g. after a failed fetch that defaulted to create),
                        // try to go back to viewing it. Otherwise, close.
                        if (currentContractData && currentContractData.workContractId) { // Check if there's actual contract data to view
                            setContractModalMode('view');
                             setContractFormData({ // Re-populate form with view data
                                workContractId: currentContractData.workContractId,
                                userId: currentContractData.userId,
                                startDate: currentContractData.startDate ? new Date(currentContractData.startDate).toISOString().split('T')[0] : '',
                                endDate: currentContractData.endDate ? new Date(currentContractData.endDate).toISOString().split('T')[0] : '',
                                salary: String(currentContractData.salary),
                                contractFileUrl: currentContractData.contractFileUrl || ''
                            });
                        } else {
                            // If no prior contract or after deletion, closing makes sense or fetch again.
                            // For simplicity, if user cancels create and there's no prior contract to view, close.
                            // fetchContractDetailsForModal(selectedWorkerForContract.id); // Or re-fetch to see if one appeared
                            handleCloseContractModal(); // Or simply close
                        }
                        setContractError(null); setContractSuccessMessage(null);
                    }}>Cancel Create</Button>
                )}
            </Form>
        );
    }

    if (isLoading && workers.length === 0 && !error) {
        return (<div className="container mt-4 text-center"><Spinner animation="border" /><p>Loading workers...</p></div>);
    }
    if (error && !isLoading && workers.length === 0) {
        return <Alert variant="danger" className="mt-4 container">{error}</Alert>;
    }

    return (
        <div className="container mt-4">
            <h1>Company Workers</h1>
            {error && <Alert variant="warning" className="mt-3" onClose={() => setError(null)} dismissible>{error}</Alert>}
            <p>Business Number: <Badge bg="info">{businessNumber || "N/A"}</Badge></p>
            {isLoading && workers.length > 0 && <div className="text-center my-2"><Spinner animation="grow" size="sm" /> Refreshing list...</div>}

            {!isLoading && workers.length === 0 && !error && (
                <Alert variant="info">No workers found for this business number.</Alert>
            )}

            {workers.length > 0 && (
                <Table striped bordered hover responsive size="sm">
                    <thead><tr><th>#</th><th>Username</th><th>Email</th><th>Status</th><th>Storehouse</th><th>Actions</th></tr></thead>
                    <tbody>
                        {workers.map((worker, index) => (
                            <tr key={worker.id}>
                                <td>{index + 1}</td><td>{worker.username}</td><td>{worker.email}</td>
                                <td><Badge bg={worker.emailConfirmed ? 'success' : 'warning'}>{worker.emailConfirmed ? 'Confirmed' : 'Pending'}</Badge></td>
                                <td>{worker.storeHouseName || 'N/A'}</td>
                                <td><Button size="sm" variant="outline-primary" onClick={() => handleShowContractModal(worker)}>Manage Contract</Button></td>
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
                            {!isContractLoading && (<>
                                {contractModalMode === 'view' && currentContractData && <Badge bg="secondary" className="ms-2">Viewing</Badge>}
                                {contractModalMode === 'create' && <Badge bg="success" className="ms-2">Creating New</Badge>}
                                {contractModalMode === 'edit' && <Badge bg="warning" className="ms-2">Editing</Badge>}
                                {contractModalMode === 'view' && !currentContractData && !contractError && <Badge bg="info" className="ms-2">No Contract Found</Badge>}
                            </>)}
                             {isContractLoading && <Spinner animation="border" size="sm" className="ms-2" />}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {contractError && <Alert variant="danger" onClose={() => setContractError(null)} dismissible>{contractError}</Alert>}
                        {contractSuccessMessage && <Alert variant="success" onClose={() => setContractSuccessMessage(null)} dismissible>{contractSuccessMessage}</Alert>}
                        
                        {isContractLoading && !contractError && !contractSuccessMessage && (<div className="text-center"><Spinner animation="border" /><p>Processing contract...</p></div>)}

                        {!isContractLoading && (<>
                            {contractModalMode === 'view' && renderContractViewMode()}
                            {(contractModalMode === 'create' || contractModalMode === 'edit') && renderContractForm()}
                            
                            {/* Button to initiate creation if in view mode and no contract exists */}
                            {contractModalMode === 'view' && !currentContractData && !contractError && (
                                <>
                                 <Alert variant="info" className="mt-3">No contract details available for this worker.</Alert>
                                <Button variant="success" className="mt-2" onClick={() => {
                                    setContractFormData({ workContractId: 0, userId: selectedWorkerForContract.id, startDate: '', endDate: '', salary: '', contractFileUrl: '' });
                                    setCurrentContractData(null); setContractError(null); setContractSuccessMessage(null);
                                    setContractModalMode('create');
                                }}>Create New Contract</Button>
                                </>
                            )}
                        </>)}
                    </Modal.Body>
                    <Modal.Footer>
                        {/* Delete Button - shown in view mode if a contract exists */}
                        {!isContractLoading && contractModalMode === 'view' && currentContractData && (
                            <Button
                                variant="danger"
                                onClick={handleDeleteContract}
                                className="me-auto" // Pushes Delete to the far left
                            >
                                Delete Contract
                            </Button>
                        )}

                        {/* Edit Button - shown in view mode if a contract exists */}
                        {!isContractLoading && contractModalMode === 'view' && currentContractData && (
                            <Button variant="warning" onClick={() => {
                                setContractFormData({
                                    workContractId: currentContractData.workContractId,
                                    userId: currentContractData.userId,
                                    startDate: currentContractData.startDate ? new Date(currentContractData.startDate).toISOString().split('T')[0] : '',
                                    endDate: currentContractData.endDate ? new Date(currentContractData.endDate).toISOString().split('T')[0] : '',
                                    salary: (currentContractData.salary !== null && currentContractData.salary !== undefined) ? String(currentContractData.salary) : '',
                                    contractFileUrl: currentContractData.contractFileUrl || ''
                                });
                                setContractModalMode('edit');
                                setContractError(null); setContractSuccessMessage(null);
                            }}>Edit This Contract</Button>
                        )}
                        
                        <Button variant="secondary" onClick={handleCloseContractModal} disabled={isContractLoading}>
                            Close
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}
        </div>
    );
}

export default AllWorkers;