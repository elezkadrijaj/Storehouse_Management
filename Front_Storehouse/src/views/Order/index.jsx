import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Table, Spinner, Alert, Button, Modal, ListGroup, Badge, Form } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE_URL = 'https://localhost:7204/api';

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

const getAuthConfig = (contentType = 'application/json') => {
    const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
    if (!token) {
        console.error('Auth token is missing from session storage.');
        // Optionally trigger logout or redirect here
        return null;
    }
    const headers = { Authorization: `Bearer ${token}` };
    if (contentType) {
        headers['Content-Type'] = contentType;
    }
    return { headers };
};

const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        // Format to YYYY-MM-DD HH:MM:SS (UTC) for clarity
        return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return 'Invalid Date';
    }
};

function OrderList() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null); // For Detail Modal
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [orderToUpdate, setOrderToUpdate] = useState(null); // For Status Update Modal
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [statusDescription, setStatusDescription] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);

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

        // *** ASSUMPTION: You have a GET /api/Orders endpoint ***
        // If not, you might fetch orders based on user ID or other criteria
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
            console.error('Error fetching orders:', err);
            setError(err.response?.data?.message || err.message || 'Failed to load orders.');
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // --- Detail Modal Handlers ---
    const handleShowDetails = async (orderId) => {
        const config = getAuthConfig();
        if (!config) return;
        try {
            // Fetch detailed order data including items and history
            const response = await axios.get(`${API_BASE_URL}/Orders/${orderId}`, config);
            setSelectedOrder(response.data);
            setShowDetailModal(true);
        } catch (err) {
            toast.error(`Failed to load details for order ${orderId}: ${err.message}`);
            console.error(`Error fetching order ${orderId} details:`, err);
        }
    };
    const handleCloseDetailModal = () => setShowDetailModal(false);

    // --- Status Update Modal Handlers ---
    const handleShowUpdateModal = (order) => {
        setOrderToUpdate(order);
        setNewStatus(''); // Reset status selection
        setStatusDescription(''); // Reset description
        setShowUpdateModal(true);
    };
    const handleCloseUpdateModal = () => setShowUpdateModal(false);

    const handleStatusUpdate = async (e) => {
        e.preventDefault();
        if (!orderToUpdate || !newStatus) {
            toast.warn('Please select a new status.');
            return;
        }

        setUpdatingStatus(true);
        const config = getAuthConfig();
        if (!config) {
            toast.error('Authentication failed.');
            setUpdatingStatus(false);
            return;
        }

        const payload = {
            status: newStatus,
            description: statusDescription || `Status updated to ${newStatus}`, // Provide a default description
        };

        try {
            await axios.put(`${API_BASE_URL}/Orders/${orderToUpdate.orderId}/status`, payload, config);
            toast.success(`Order ${orderToUpdate.orderId} status updated successfully!`);
            handleCloseUpdateModal();
            fetchOrders(); // Refresh the list
        } catch (err) {
            console.error('Error updating order status:', err);
            const errorMsg = err.response?.data?.message || err.response?.data || err.message || 'Failed to update status.';
            if (err.response?.status === 403) {
                toast.error('Forbidden: You do not have permission to set this status.');
            } else {
                toast.error(`Update failed: ${errorMsg}`);
            }
        } finally {
            setUpdatingStatus(false);
        }
    };

    // --- Render Logic ---
    if (loading) {
        return <div className="text-center my-5"><Spinner animation="border" /> Loading orders...</div>;
    }

    if (error) {
        return <Alert variant="danger">Error: {error}</Alert>;
    }

    return (
        <div className="container mt-4">
            <h2>Order Management</h2>
            <ToastContainer position="top-right" autoClose={3000} />
            <Button 
                variant="primary" 
                className="mb-3"
                onClick={() => window.location.href = '/app/createorder'}
            >
                Create New Order
            </Button>

            {orders.length === 0 ? (
                <Alert variant="info">No orders found.</Alert>
            ) : (
                <div className="table-responsive">
                    <Table striped bordered hover responsive="sm">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Status</th>
                                <th>Created Date</th>
                                <th>Total Price</th>
                                <th>User ID</th> {/* Consider displaying Username if available */}
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order.orderId}>
                                    <td>{order.orderId}</td>
                                    <td><Badge bg={getStatusBadgeVariant(order.status)}>{order.status || 'N/A'}</Badge></td>
                                    <td>{formatDateForDisplay(order.created)}</td>
                                    <td>${order.totalPrice?.toFixed(2) ?? '0.00'}</td>
                                    <td>{order.userId || 'N/A'}</td>
                                    <td>
                                        <Button variant="info" size="sm" className="me-2" onClick={() => handleShowDetails(order.orderId)}>
                                            Details
                                        </Button>
                                        <Button variant="warning" size="sm" onClick={() => handleShowUpdateModal(order)}>
                                            Update Status
                                        </Button>
                                        {/* Add Delete button if applicable */}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            )}

            {/* Order Detail Modal */}
            <Modal show={showDetailModal} onHide={handleCloseDetailModal} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Order Details (ID: {selectedOrder?.orderId})</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedOrder ? (
                        <>
                            <p><strong>Status:</strong> <Badge bg={getStatusBadgeVariant(selectedOrder.status)}>{selectedOrder.status}</Badge></p>
                            <p><strong>Created:</strong> {formatDateForDisplay(selectedOrder.created)}</p>
                            <p><strong>Total Price:</strong> ${selectedOrder.totalPrice?.toFixed(2)}</p>
                            <p><strong>User:</strong> {selectedOrder.appUsers?.userName || selectedOrder.userId || 'N/A'}</p> {/* Display username if available */}

                            <h5>Order Items</h5>
                            {selectedOrder.orderItems && selectedOrder.orderItems.length > 0 ? (
                                <ListGroup variant="flush">
                                    {selectedOrder.orderItems.map(item => (
                                        <ListGroup.Item key={item.orderItemId}>
                                            {/* You might need to fetch Product Name based on item.productsId */}
                                            Product ID: {item.productsId} - Quantity: {item.quantity} - Price: ${item.price?.toFixed(2)}
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            ) : <p>No items found for this order.</p>}

                            <h5 className="mt-3">Status History</h5>
                            {selectedOrder.orderStatusHistories && selectedOrder.orderStatusHistories.length > 0 ? (
                                <ListGroup variant="flush">
                                    {selectedOrder.orderStatusHistories.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(history => ( // Sort newest first
                                        <ListGroup.Item key={history.orderStatusHistoryId}>
                                            <strong>{history.status}</strong> ({formatDateForDisplay(history.timestamp)})
                                            <br />
                                            <small>By User ID: {history.updatedByUserId}</small>
                                            {history.description && <><br /><small>Desc: {history.description}</small></>}
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            ) : <p>No status history found.</p>}
                        </>
                    ) : (
                        <Spinner animation="border" />
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseDetailModal}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Update Status Modal */}
            <Modal show={showUpdateModal} onHide={handleCloseUpdateModal}>
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
                                {userrole === 'CompanyManager' && (
                                    <>
                                        <option value="Canceled">Canceled</option>
                                    </>
                                )}
                                {userrole === 'StorehouseManager' && (
                                    <>
                                        <option value="Billed">Billed</option>
                                        <option value="ReadyForDelivery">Ready For Delivery</option>
                                    </>
                                )}
                                {(userrole === 'Transporter' && orderToUpdate.status === 'ReadyForDelivery') && (
                                    <>
                                        <option value="InTransit">In Transit</option>
                                        <option value="Completed">Completed</option>
                                    </>
                                )}
                                {(userrole === 'Transporter' && orderToUpdate.status === 'InTransit') && (
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
                        <Button variant="primary" type="submit" disabled={updatingStatus || !newStatus}>
                            {updatingStatus ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Updating...</> : 'Update Status'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </div>
    );
}

// Helper function for badge colors based on status
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

export default OrderList;