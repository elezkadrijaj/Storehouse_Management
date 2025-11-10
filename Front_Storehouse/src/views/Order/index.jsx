import React, { useState, useEffect, useCallback } from 'react';
import { Table, Alert, Spinner, Badge, Button, Modal, ListGroup, Form, Row, Col } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import { saveAs } from 'file-saver';
import { PlusLg, Eye, FileEarmarkText, ArrowClockwise, PersonPlusFill, PersonCheckFill } from 'react-bootstrap-icons';
import apiClient from '../../appService';

// REFACTORED: TOKEN is no longer stored here.
const SESSION_STORAGE_KEYS = {
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
    BUSINESS_NUMBER: 'companyBusinessNumber',
};

// NOTE: The getAuthConfig function has been completely removed.

// Helper functions (unchanged)
const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? 'Invalid Date' : date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    } catch (e) {
        return 'Invalid Date';
    }
};

const getStatusBadgeVariant = (status) => {
    switch (status?.toLowerCase()) {
        case 'created': return 'secondary';
        case 'billed': return 'info';
        case 'readyfordelivery': return 'primary';
        case 'intransit': return 'warning';
        case 'completed': return 'success';
        case 'returned': return 'danger';
        case 'canceled': return 'dark';
        default: return 'light';
    }
};

function OrderList() {
    // All state hooks remain the same.
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [orderToUpdate, setOrderToUpdate] = useState(null);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [statusDescription, setStatusDescription] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [generatingInvoiceId, setGeneratingInvoiceId] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [orderToAssign, setOrderToAssign] = useState(null);
    const [availableWorkers, setAvailableWorkers] = useState([]);
    const [loadingWorkers, setLoadingWorkers] = useState(false);
    const userrole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);

    // REFACTORED: Simplified fetchOrders
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/Orders');
            setOrders(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load orders.");
        } finally {
            setLoading(false);
        }
    }, []);

    // REFACTORED: Simplified fetchWorkers
    const fetchWorkers = useCallback(async () => {
        if (userrole !== 'CompanyManager' && userrole !== 'StorehouseManager') return;
        
        const businessNumber = sessionStorage.getItem(SESSION_STORAGE_KEYS.BUSINESS_NUMBER);
        if (!businessNumber) {
            toast.error('Company business number not found. Cannot load workers.');
            return;
        }

        setLoadingWorkers(true);
        try {
            const response = await apiClient.get(`/Account/all-workers/${businessNumber}`);
            setAvailableWorkers(response.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load available workers.');
        } finally {
            setLoadingWorkers(false);
        }
    }, [userrole]);

    useEffect(() => {
        const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
        if (userRole) {
            fetchOrders();
            fetchWorkers();
        } else {
            setError("You are not logged in. Please log in to view orders.");
            setLoading(false);
        }
    }, [fetchOrders, fetchWorkers]);

    const handleShowDetails = async (orderId) => {
        try {
            const response = await apiClient.get(`/Orders/${orderId}`);
            setSelectedOrder(response.data);
            setShowDetailModal(true);
        } catch (err) {
            toast.error(`Failed to load details for order ${orderId}: ${err.response?.data?.message || err.message}`);
        }
    };

    const handleStatusUpdate = async (e) => {
        e.preventDefault();
        if (!orderToUpdate || !newStatus) {
            toast.warn('Please select a new status.');
            return;
        }
        setUpdatingStatus(true);
        const payload = { status: newStatus, description: statusDescription || `Status updated to ${newStatus}` };
        try {
            await apiClient.put(`/Orders/${orderToUpdate.orderId}/status`, payload);
            toast.success(`Order #${orderToUpdate.orderId} status updated successfully!`);
            handleCloseUpdateModal();
            fetchOrders();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update status.');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleGenerateInvoice = async (orderId) => {
        setGeneratingInvoiceId(orderId);
        try {
            const response = await apiClient.get(`/Orders/${orderId}/invoice`, { responseType: 'blob' });
            let filename = `Invoice_Order_${orderId}.pdf`;
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch?.[1]) filename = filenameMatch[1];
            }
            saveAs(new Blob([response.data], { type: 'application/pdf' }), filename);
            toast.success(`Invoice for order ${orderId} downloaded successfully!`);
        } catch (err) {
            let errorMsg = 'Failed to generate invoice.';
            if (err.response?.data instanceof Blob && err.response.data.type === "application/json") {
                try {
                    const errorJson = JSON.parse(await err.response.data.text());
                    if (errorJson.message) errorMsg = errorJson.message;
                } catch (parseError) { /* ignore */ }
            }
            toast.error(errorMsg);
        } finally {
            setGeneratingInvoiceId(null);
        }
    };
    
    // Other handlers that don't make API calls remain the same
    const handleCloseDetailModal = () => { setShowDetailModal(false); setSelectedOrder(null); };
    const handleShowUpdateModal = (order) => { setOrderToUpdate(order); setNewStatus(''); setStatusDescription(''); setShowUpdateModal(true); };
    const handleCloseUpdateModal = () => { setShowUpdateModal(false); setOrderToUpdate(null); };
    const handleShowAssignModal = (order) => { setOrderToAssign(order); setShowAssignModal(true); };
    const handleCloseAssignModal = () => { setShowAssignModal(false); setOrderToAssign(null); };

    if (loading && orders.length === 0) {
        return <div className="text-center my-5"><Spinner animation="border" /> Loading orders...</div>;
    }
    if (error && orders.length === 0) {
        return <Alert variant="danger" className="m-3">Error fetching orders: {error}</Alert>;
    }

    return (
        <div className="container-fluid mt-4">
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Order Management</h2>
                {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                    <Button variant="success" onClick={() => window.location.href = '/app/createorder'}>
                        <PlusLg className="me-2" /> Create New Order
                    </Button>
                )}
            </div>
            {loading && <div className="text-center mb-2"><Spinner animation="border" size="sm" /> Refreshing orders...</div>}
            {error && !loading && <Alert variant="danger" onClose={() => setError(null)} dismissible>Failed to load orders: {error}</Alert>}
            {!loading && orders.length === 0 ? (
                <Alert variant="info" className="text-center py-4"><h4>No Orders Found</h4><p className="mb-0">There are no orders in the system yet.</p></Alert>
            ) : (
                <div className="table-responsive">
                    <Table striped bordered hover responsive="lg" className="align-middle shadow-sm">
                        <thead style={{ backgroundColor: '#4F5D75', color: 'white' }}>
                            <tr><th>Order ID</th><th>Client Name</th><th>Status</th><th>Created Date</th><th>Total Price</th><th>Shipping To</th><th className="text-center">Actions</th></tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order.orderId}>
                                    <td className="fw-bold">{order.orderId}</td><td>{order.clientName || 'N/A'}</td>
                                    <td><Badge bg={getStatusBadgeVariant(order.status)}>{order.status || 'N/A'}</Badge></td>
                                    <td>{formatDateForDisplay(order.created)}</td>
                                    <td>${order.totalPrice?.toFixed(2) ?? '0.00'}</td>
                                    <td>{order.shippingAddressCity || order.shippingAddressCountry ? `${order.shippingAddressCity || ''}${order.shippingAddressCity && order.shippingAddressCountry ? ', ' : ''}${order.shippingAddressCountry || ''}` : 'N/A'}</td>
                                    <td className="text-center">
                                        <div className="d-flex justify-content-center gap-2 flex-wrap">
                                            {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                                                <>
                                                    <Button variant="outline-primary" size="sm" onClick={() => handleShowDetails(order.orderId)} title="View Order Details"><Eye /> <span className="d-none d-md-inline">Details</span></Button>
                                                    <Button variant="outline-info" size="sm" onClick={() => handleGenerateInvoice(order.orderId)} disabled={generatingInvoiceId === order.orderId} title="Generate Invoice">{generatingInvoiceId === order.orderId ? (<><Spinner as="span" animation="border" size="sm" /> <span className="d-none d-md-inline">...</span></>) : (<><FileEarmarkText /> <span className="d-none d-md-inline">Invoice</span></>)}</Button>
                                                    <Button variant="outline-secondary" size="sm" onClick={() => handleShowAssignModal(order)} title="Assign Workers"><PersonPlusFill /><span className="d-none d-md-inline ms-1">Assign</span></Button>
                                                </>
                                            )}
                                            <Button variant="outline-warning" size="sm" onClick={() => handleShowUpdateModal(order)} title="Update Order Status"><ArrowClockwise /> <span className="d-none d-md-inline">Update Status</span></Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            )}
            <Modal show={showDetailModal} onHide={handleCloseDetailModal} size="lg" centered backdrop="static">
                <Modal.Header closeButton><Modal.Title>Order Details (ID: {selectedOrder?.orderId})</Modal.Title></Modal.Header>
                <Modal.Body>
                    {selectedOrder ? (
                        <>
                            <Row className="mb-3"><Col md={6}><p className="mb-1"><strong>Order ID:</strong> {selectedOrder.orderId}</p><p className="mb-1"><strong>Status:</strong> <Badge bg={getStatusBadgeVariant(selectedOrder.status)}>{selectedOrder.status}</Badge></p></Col><Col md={6}><p className="mb-1"><strong>Created:</strong> {formatDateForDisplay(selectedOrder.created)}</p><p className="mb-1"><strong>Total Price:</strong> ${selectedOrder.totalPrice?.toFixed(2)}</p></Col></Row>
                            <p><strong>Internal User (Creator):</strong> {selectedOrder.appUsers?.userName || 'N/A'}</p><hr />
                            <h5>Assigned Workers</h5>
                            {selectedOrder.orderAssignments && selectedOrder.orderAssignments.length > 0 ? (
                                <ListGroup variant="flush" className="mb-3">
                                    {selectedOrder.orderAssignments.map(assignment => (
                                        <ListGroup.Item key={assignment.workerId} className="px-0 py-2 d-flex justify-content-between align-items-center">
                                            <div><PersonCheckFill className="me-2" /><strong>{assignment.worker.userName}</strong><br /><small className="text-muted">{assignment.worker.email}</small></div>
                                            <Badge bg="info" pill>Assigned: {formatDateForDisplay(assignment.assignedAt)}</Badge>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            ) : <p className="text-muted">No workers are currently assigned to this order.</p>}<hr />
                            <h5>Client Information</h5><Row className="mb-3"><Col md={6}><p className="mb-1"><strong>Name:</strong> {selectedOrder.clientName || 'N/A'}</p></Col><Col md={6}><p className="mb-1"><strong>Phone:</strong> {selectedOrder.clientPhoneNumber || 'N/A'}</p></Col></Row><hr />
                            <h5>Shipping Address</h5><p className="mb-1">{selectedOrder.shippingAddressStreet || 'N/A'}</p><p className="mb-1">{selectedOrder.shippingAddressCity || ''}{selectedOrder.shippingAddressCity && selectedOrder.shippingAddressPostalCode ? ', ' : ''}{selectedOrder.shippingAddressPostalCode || ''}</p><p className="mb-1">{selectedOrder.shippingAddressCountry || 'N/A'}</p><hr />
                            <h5>Order Items</h5>
                            {selectedOrder.orderItems && selectedOrder.orderItems.length > 0 ? (<ListGroup variant="flush" className="mb-3">{selectedOrder.orderItems.map(item => (<ListGroup.Item key={item.orderItemId} className="px-0 py-2">Product Name: {item.productName} - Quantity: {item.quantity} - Unit Price: ${item.price?.toFixed(2)}</ListGroup.Item>))}</ListGroup>) : <p className="text-muted">No items found for this order.</p>}
                            <h5>Status History</h5>
                            {selectedOrder.orderStatusHistories && selectedOrder.orderStatusHistories.length > 0 ? (<ListGroup variant="flush">{selectedOrder.orderStatusHistories.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(history => (<ListGroup.Item key={history.orderStatusHistoryId} className="px-0 py-2"><strong>{history.status}</strong> ({formatDateForDisplay(history.timestamp)})<br /><small>By User ID: {history.updatedByUserId}</small>{history.description && <><br /><small>Description: {history.description}</small></>}</ListGroup.Item>))}</ListGroup>) : <p className="text-muted">No status history found.</p>}
                        </>
                    ) : (<div className="text-center py-3"><Spinner animation="border" /> Loading details...</div>)}
                </Modal.Body>
                <Modal.Footer><Button variant="secondary" onClick={handleCloseDetailModal}>Close</Button></Modal.Footer>
            </Modal>
            <Modal show={showUpdateModal} onHide={handleCloseUpdateModal} centered backdrop="static">
                <Modal.Header closeButton><Modal.Title>Update Status for Order #{orderToUpdate?.orderId}</Modal.Title></Modal.Header>
                <Form onSubmit={handleStatusUpdate}>
                    <Modal.Body>
                        <p>Current Status: <Badge bg={getStatusBadgeVariant(orderToUpdate?.status)}>{orderToUpdate?.status}</Badge></p>
                        <Form.Group className="mb-3" controlId="newStatusSelect"><Form.Label>New Status</Form.Label>
                            <Form.Select aria-label="Select new status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} required>
                                <option value="" disabled>-- Select Status --</option>
                                {userrole === 'CompanyManager' && orderToUpdate?.status === 'Created' && (<option value="Canceled">Canceled</option>)}
                                {userrole === 'StorehouseManager' && orderToUpdate?.status === 'Created' && (<><option value="Billed">Billed</option><option value="ReadyForDelivery">Ready For Delivery</option></>)}
                                {userrole === 'Worker' && orderToUpdate?.status === 'ReadyForDelivery' && (<><option value="InTransit">In Transit</option><option value="Completed">Completed</option></>)}
                                {userrole === 'Worker' && orderToUpdate?.status === 'InTransit' && (<><option value="Returned">Returned</option><option value="Completed">Completed</option></>)}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="statusDescription"><Form.Label>Description (Optional)</Form.Label><Form.Control as="textarea" rows={2} value={statusDescription} onChange={(e) => setStatusDescription(e.target.value)} placeholder="Reason for status change..." /></Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseUpdateModal} disabled={updatingStatus}>Cancel</Button>
                        <Button variant="warning" type="submit" disabled={updatingStatus || !newStatus}>{updatingStatus ? (<><Spinner as="span" animation="border" size="sm" /> <span className="ms-1">Updating...</span></>) : (<><ArrowClockwise className="me-2" /> Update Status</>)}</Button>
                    </Modal.Footer>
                </Form>
            </Modal>
            <AssignWorkersModal show={showAssignModal} handleClose={handleCloseAssignModal} order={orderToAssign} workers={availableWorkers} loading={loadingWorkers} onAssign={fetchOrders} />
        </div>
    );
}

function AssignWorkersModal({ show, handleClose, order, workers, loading, onAssign }) {
    const [selectedWorkerIds, setSelectedWorkerIds] = useState([]);
    const [isAssigning, setIsAssigning] = useState(false);

    useEffect(() => {
        const currentWorkerIds = order?.orderAssignments?.map(oa => oa.workerId) || [];
        setSelectedWorkerIds(currentWorkerIds);
    }, [order]);

    const handleCheckboxChange = (workerId) => {
        setSelectedWorkerIds(prev => prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]);
    };

    const handleAssignClick = async () => {
        if (!order?.orderId) return;
        setIsAssigning(true);
        const payload = { workerIds: selectedWorkerIds };

        try {
            // REFACTORED: Simplified API call.
            await apiClient.post(`/Orders/${order.orderId}/assign-workers`, payload);
            toast.success(`Workers assigned to order #${order.orderId} successfully!`);
            onAssign();
            handleClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to assign workers.');
        } finally {
            setIsAssigning(false);
        }
    };
    
    return (
        <Modal show={show} onHide={handleClose} centered backdrop="static">
            <Modal.Header closeButton><Modal.Title>Assign Workers to Order #{order?.orderId}</Modal.Title></Modal.Header>
            <Modal.Body>
                {loading ? (<div className="text-center"><Spinner animation="border" /> Loading workers...</div>) :
                    workers.length > 0 ? (
                        <Form>
                            <Form.Label>Available Workers:</Form.Label>
                            <ListGroup style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {workers.map(worker => (
                                    <ListGroup.Item key={worker.id}>
                                        <Form.Check
                                            type="checkbox"
                                            id={`worker-${worker.id}`}
                                            label={`${worker.userName || 'N/A'} (${worker.email || 'N/A'})`}
                                            checked={selectedWorkerIds.includes(worker.id)}
                                            onChange={() => handleCheckboxChange(worker.id)}
                                        />
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        </Form>
                    ) : (<Alert variant="info">No available workers found to assign.</Alert>)
                }
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose} disabled={isAssigning}>Cancel</Button>
                <Button variant="primary" onClick={handleAssignClick} disabled={isAssigning || loading || workers.length === 0}>
                    {isAssigning ? (<><Spinner as="span" animation="border" size="sm" /> Assigning...</>) : 'Assign Selected Workers'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

export default OrderList;