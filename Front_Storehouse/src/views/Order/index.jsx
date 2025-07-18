import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Table, Spinner, Alert, Button, Modal, ListGroup, Badge, Form, Row, Col } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import { saveAs } from 'file-saver';
import { PlusLg, Eye, FileEarmarkText, ArrowClockwise } from 'react-bootstrap-icons';

const API_BASE_URL = 'https://localhost:7204/api';
const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

const getAuthConfig = (contentType = 'application/json', responseType = 'json') => {
    const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
    if (!token) {
        console.error('Auth token is missing from session storage.');
        toast.error('Authentication token missing. Please log in.');
        return null;
    }
    const headers = { Authorization: `Bearer ${token}` };
    if (contentType) {
        headers['Content-Type'] = contentType;
    }
    return { headers, responseType };
};

const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            console.warn("Invalid date string for display:", dateString);
            return 'Invalid Date';
        }
        return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    } catch (e) {
        console.error("Error formatting date for display:", dateString, e);
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

    const userrole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        const config = getAuthConfig();
        if (!config) {
            setError('Authentication token not found. Please log in.');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.get(`${API_BASE_URL}/Orders`, config);
            if (Array.isArray(response.data)) {
                setOrders(response.data);
            } else {
                console.error("API did not return an array of orders:", response.data);
                setError("Received unexpected data format for orders.");
                setOrders([]);
            }
        } catch (err) {
            console.error('Error fetching orders:', err.response || err);
            const errorData = err.response?.data;
            let errorMsg = "Failed to load orders.";
            if (typeof errorData === 'string') {
                errorMsg = errorData;
            } else if (errorData?.message) {
                errorMsg = errorData.message;
            } else if (err.message) {
                errorMsg = err.message;
            }
            setError(errorMsg);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleShowDetails = async (orderId) => {
        const config = getAuthConfig();
        if (!config) return;
        try {
            const response = await axios.get(`${API_BASE_URL}/Orders/${orderId}`, config);
            setSelectedOrder(response.data);
            setShowDetailModal(true);
        } catch (err) {
            toast.error(`Failed to load details for order ${orderId}: ${err.response?.data?.message || err.message}`);
            console.error(`Error fetching order ${orderId} details:`, err);
        }
    };
    const handleCloseDetailModal = () => {
        setShowDetailModal(false);
        setSelectedOrder(null);
    };

    const handleShowUpdateModal = (order) => {
        setOrderToUpdate(order);
        setNewStatus('');
        setStatusDescription('');
        setShowUpdateModal(true);
    };
    const handleCloseUpdateModal = () => {
        setShowUpdateModal(false);
        setOrderToUpdate(null);
    }

    const handleStatusUpdate = async (e) => {
        e.preventDefault();
        if (!orderToUpdate || !newStatus) {
            toast.warn('Please select a new status.');
            return;
        }
        setUpdatingStatus(true);
        const config = getAuthConfig();
        if (!config) {
            setUpdatingStatus(false);
            return;
        }
        const payload = {
            status: newStatus,
            description: statusDescription || `Status updated to ${newStatus}`,
        };
        try {
            await axios.put(`${API_BASE_URL}/Orders/${orderToUpdate.orderId}/status`, payload, config);
            toast.success(`Order ${orderToUpdate.orderId} status updated successfully!`);
            handleCloseUpdateModal();
            fetchOrders();
        } catch (err) {
            console.error('Error updating order status:', err.response || err);
            const errorData = err.response?.data;
            let errorMsg = 'Failed to update status.';
            if (err.response?.status === 403) {
                errorMsg = 'Forbidden: You do not have permission to set this status.';
            } else if (typeof errorData === 'string') {
                errorMsg = errorData;
            } else if (errorData?.message) {
                errorMsg = errorData.message;
            } else if (err.message) {
                errorMsg = err.message;
            }
            toast.error(`Update failed: ${errorMsg}`);
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleGenerateInvoice = async (orderId, clientName) => {
        setGeneratingInvoiceId(orderId);
        const config = getAuthConfig(null, 'blob');
        if (!config) {
            setGeneratingInvoiceId(null);
            return;
        }

        try {
            const response = await axios.get(`${API_BASE_URL}/Orders/${orderId}/invoice`, config);
            
            let filename = `Invoice_Order_${orderId}.pdf`;
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch.length > 1) {
                    filename = filenameMatch[1];
                }
            }
            
            saveAs(new Blob([response.data], { type: 'application/pdf' }), filename);
            toast.success(`Invoice for order ${orderId} downloaded successfully!`);

        } catch (err) {
            console.error(`Error generating invoice for order ${orderId}:`, err.response || err);
            let errorMsg = `Failed to generate invoice for order ${orderId}.`;
            if (err.response && err.response.data instanceof Blob && err.response.data.type === "application/json") {
                try {
                    const errorJson = JSON.parse(await err.response.data.text());
                    if (errorJson.message) {
                        errorMsg = errorJson.message;
                    }
                } catch (parseError) {
                    console.error("Could not parse error blob:", parseError);
                }
            } else if (err.response?.data?.message) {
                errorMsg = err.response.data.message;
            } else if (err.message) {
                errorMsg = err.message;
            }
            toast.error(errorMsg);
        } finally {
            setGeneratingInvoiceId(null);
        }
    };


    if (loading && orders.length === 0) {
        return <div className="text-center my-5"><Spinner animation="border" /> Loading orders...</div>;
    }

    if (error && orders.length === 0) {
        return <Alert variant="danger" className="m-3">Error fetching orders: {error}</Alert>;
    }

    return (
        <div className="container-fluid mt-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Order Management</h2>
                {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                    <Button
                        variant="success"
                        onClick={() => window.location.href = '/app/createorder'}
                    >
                        <PlusLg className="me-2" /> Create New Order
                    </Button>
                )}
            </div>
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />

            {loading && <div className="text-center mb-2"><Spinner animation="border" size="sm" /> Refreshing orders...</div>}
            {error && !loading && <Alert variant="danger" onClose={() => setError(null)} dismissible>Failed to load orders: {error}</Alert>}

            {!loading && orders.length === 0 ? (
                <Alert variant="info" className="text-center py-4">
                    <h4>No Orders Found</h4>
                    <p className="mb-0">There are no orders in the system yet.</p>
                </Alert>
            ) : (
                <div className="table-responsive">
                    <Table striped bordered hover responsive="lg" className="align-middle shadow-sm">
                        <thead style={{ backgroundColor: '#4F5D75', color: 'white' }}>
                            <tr>
                                <th>Order ID</th>
                                <th>Client Name</th>
                                <th>Status</th>
                                <th>Created Date</th>
                                <th>Total Price</th>
                                <th>Shipping To</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order.orderId}>
                                    <td className="fw-bold">{order.orderId}</td>
                                    <td>{order.clientName || 'N/A'}</td>
                                    <td><Badge bg={getStatusBadgeVariant(order.status)}>{order.status || 'N/A'}</Badge></td>
                                    <td>{formatDateForDisplay(order.created)}</td>
                                    <td>${order.totalPrice?.toFixed(2) ?? '0.00'}</td>
                                    <td>
                                        {order.shippingAddressCity || order.shippingAddressCountry
                                            ? `${order.shippingAddressCity || ''}${order.shippingAddressCity && order.shippingAddressCountry ? ', ' : ''}${order.shippingAddressCountry || ''}`
                                            : 'N/A'}
                                    </td>
                                    <td className="text-center">
                                        <div className="d-flex justify-content-center gap-2 flex-wrap">
                                            {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                                                <>
                                                    <Button 
                                                        variant="outline-primary" 
                                                        size="sm" 
                                                        onClick={() => handleShowDetails(order.orderId)}
                                                        title="View Order Details"
                                                    >
                                                        <Eye /> <span className="d-none d-md-inline">Details</span>
                                                    </Button>
                                                    <Button 
                                                        variant="outline-info" 
                                                        size="sm"
                                                        onClick={() => handleGenerateInvoice(order.orderId, order.clientName)}
                                                        disabled={generatingInvoiceId === order.orderId}
                                                        title="Generate Invoice"
                                                    >
                                                        {generatingInvoiceId === order.orderId ? (
                                                            <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> <span className="d-none d-md-inline">Downloading...</span></>
                                                        ) : (
                                                            <><FileEarmarkText /> <span className="d-none d-md-inline">Invoice</span></>
                                                        )}
                                                    </Button>
                                                </>
                                            )}
                                            <Button 
                                                variant="outline-warning" 
                                                size="sm" 
                                                onClick={() => handleShowUpdateModal(order)}
                                                title="Update Order Status"
                                            >
                                                <ArrowClockwise /> <span className="d-none d-md-inline">Update Status</span>
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            )}

            <Modal show={showDetailModal} onHide={handleCloseDetailModal} size="lg" centered backdrop="static" keyboard={false}>
                <Modal.Header closeButton>
                    <Modal.Title>Order Details (ID: {selectedOrder?.orderId})</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedOrder ? (
                        <>
                             <Row className="mb-3">
                                <Col md={6}>
                                    <p className="mb-1"><strong>Order ID:</strong> {selectedOrder.orderId}</p>
                                    <p className="mb-1"><strong>Status:</strong> <Badge bg={getStatusBadgeVariant(selectedOrder.status)}>{selectedOrder.status}</Badge></p>
                                </Col>
                                <Col md={6}>
                                    <p className="mb-1"><strong>Created:</strong> {formatDateForDisplay(selectedOrder.created)}</p>
                                    <p className="mb-1"><strong>Total Price:</strong> ${selectedOrder.totalPrice?.toFixed(2)}</p>
                                </Col>
                            </Row>
                            <p><strong>Internal User (Creator/Assigned):</strong> {selectedOrder.appUsers?.userName || selectedOrder.userId || 'N/A'}</p>
                            <hr />

                            <h5>Client Information</h5>
                            <Row className="mb-3">
                                <Col md={6}>
                                    <p className="mb-1"><strong>Name:</strong> {selectedOrder.clientName || 'N/A'}</p>
                                </Col>
                                <Col md={6}>
                                    <p className="mb-1"><strong>Phone:</strong> {selectedOrder.clientPhoneNumber || 'N/A'}</p>
                                </Col>
                            </Row>
                            <hr />

                            <h5>Shipping Address</h5>
                            <p className="mb-1">
                                {selectedOrder.shippingAddressStreet || 'N/A'}
                            </p>
                            <p className="mb-1">
                                {selectedOrder.shippingAddressCity || ''}
                                {selectedOrder.shippingAddressCity && selectedOrder.shippingAddressPostalCode ? ', ' : ''}
                                {selectedOrder.shippingAddressPostalCode || ''}
                            </p>
                            <p className="mb-1">
                                {selectedOrder.shippingAddressCountry || 'N/A'}
                            </p>
                            <hr />

                            <h5>Order Items</h5>
                            {selectedOrder.orderItems && selectedOrder.orderItems.length > 0 ? (
                                <ListGroup variant="flush" className="mb-3">
                                    {selectedOrder.orderItems.map(item => (
                                        <ListGroup.Item key={item.orderItemId} className="px-0 py-2">
                                            Product Name: {item.productName} - Quantity: {item.quantity} - Unit Price: ${item.price?.toFixed(2)}
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            ) : <p className="text-muted">No items found for this order.</p>}

                            <h5>Status History</h5>
                            {selectedOrder.orderStatusHistories && selectedOrder.orderStatusHistories.length > 0 ? (
                                <ListGroup variant="flush">
                                    {selectedOrder.orderStatusHistories.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(history => (
                                        <ListGroup.Item key={history.orderStatusHistoryId} className="px-0 py-2">
                                            <strong>{history.status}</strong> ({formatDateForDisplay(history.timestamp)})
                                            <br />
                                            <small>By User ID: {history.updatedByUserId}</small>
                                            {history.description && <><br /><small>Description: {history.description}</small></>}
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            ) : <p className="text-muted">No status history found.</p>}
                        </>
                    ) : (
                        <div className="text-center py-3"><Spinner animation="border" /> Loading details...</div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseDetailModal}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showUpdateModal} onHide={handleCloseUpdateModal} centered backdrop="static" keyboard={false}>
                <Modal.Header closeButton>
                    <Modal.Title>Update Status for Order #{orderToUpdate?.orderId}</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleStatusUpdate}>
                    <Modal.Body>
                        <p>Current Status: <Badge bg={getStatusBadgeVariant(orderToUpdate?.status)}>{orderToUpdate?.status}</Badge></p>
                        <Form.Group className="mb-3" controlId="newStatusSelect">
                            <Form.Label>New Status</Form.Label>
                            <Form.Select
                                aria-label="Select new status"
                                value={newStatus}
                                onChange={(e) => setNewStatus(e.target.value)}
                                required
                            >
                                <option value="" disabled>-- Select Status --</option>
                                {userrole === 'CompanyManager' && orderToUpdate?.status === 'Created' && (
                                    <option value="Canceled">Canceled</option>
                                )}
                                {userrole === 'StorehouseManager' && orderToUpdate?.status === 'Created' && (
                                    <>
                                        <option value="Billed">Billed</option>
                                        <option value="ReadyForDelivery">Ready For Delivery</option>
                                    </>
                                )}
                                {userrole === 'Worker' && orderToUpdate?.status === 'ReadyForDelivery' && (
                                    <>
                                        <option value="InTransit">In Transit</option>
                                        <option value="Completed">Completed</option>
                                    </>
                                )}
                                {userrole === 'Worker' && orderToUpdate?.status === 'InTransit' && (
                                    <>
                                        <option value="Returned">Returned</option>
                                        <option value="Completed">Completed</option>
                                    </>
                                )}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="statusDescription">
                            <Form.Label>Description (Optional)</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={statusDescription}
                                onChange={(e) => setStatusDescription(e.target.value)}
                                placeholder="Reason for status change..."
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseUpdateModal} disabled={updatingStatus}>
                            Cancel
                        </Button>
                        <Button variant="warning" type="submit" disabled={updatingStatus || !newStatus}>
                            {updatingStatus ? (
                                <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> <span className="ms-1">Updating...</span></>
                            ) : (
                                <><ArrowClockwise className="me-2" /> Update Status</>
                            )}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </div>
    );
}

export default OrderList;