import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Form, Button, Table, Spinner, Alert, InputGroup, FormControl, Row, Col } from 'react-bootstrap';
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

function CreateOrderForm() {
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [productError, setProductError] = useState(null);
    const [orderItems, setOrderItems] = useState([]); // State to hold items being added to the order
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedQuantity, setSelectedQuantity] = useState(1);
    const [creatingOrder, setCreatingOrder] = useState(false);
    const [createError, setCreateError] = useState(null);

    // Fetch available products for selection
    const fetchProducts = useCallback(async () => {
        setLoadingProducts(true);
        setProductError(null);
        const config = getAuthConfig();
        if (!config) {
            setProductError('Authentication token not found.');
            setLoadingProducts(false);
            return;
        }
        // *** ASSUMPTION: You have a GET /api/Product endpoint to list products ***
        try {
            const response = await axios.get(`${API_BASE_URL}/Product`, config);
            if (Array.isArray(response.data)) {
                 // Filter out products with 0 or less stock if necessary
                 setProducts(response.data.filter(p => p.stock > 0));
            } else {
                 setProductError("Received unexpected data format for products.");
                 setProducts([]);
            }
        } catch (err) {
            console.error('Error fetching products:', err);
            setProductError(err.response?.data?.message || err.message || 'Failed to load products.');
             setProducts([]);
        } finally {
            setLoadingProducts(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleAddOrderItem = () => {
        if (!selectedProductId || selectedQuantity <= 0) {
            toast.warn('Please select a product and enter a valid quantity (greater than 0).');
            return;
        }

        const product = products.find(p => p.productId === selectedProductId);
        if (!product) {
            toast.error('Selected product not found.');
            return;
        }

        // Check if product already exists in the order
        const existingItemIndex = orderItems.findIndex(item => item.productId === selectedProductId);

        if (existingItemIndex > -1) {
            // Update quantity of existing item
            const updatedItems = [...orderItems];
            updatedItems[existingItemIndex].quantity += selectedQuantity;
             // Optional: Check against available stock
            // if (updatedItems[existingItemIndex].quantity > product.stock) {
            //     toast.error(`Cannot add more ${product.name}. Available stock: ${product.stock}`);
            //     updatedItems[existingItemIndex].quantity = product.stock; // Cap at stock
            // }
            setOrderItems(updatedItems);
            toast.info(`Updated quantity for ${product.name}.`);

        } else {
             // Optional: Check against available stock before adding
            // if (selectedQuantity > product.stock) {
            //     toast.error(`Cannot add ${selectedQuantity} of ${product.name}. Available stock: ${product.stock}`);
            //     return;
            // }
            // Add new item
            setOrderItems([
                ...orderItems,
                {
                    productId: selectedProductId,
                    quantity: selectedQuantity,
                    // Add product name and price for display purposes
                    name: product.name,
                    price: product.price
                }
            ]);
             toast.success(`${product.name} added to order.`);
        }

        // Reset selection
        setSelectedProductId('');
        setSelectedQuantity(1);
    };

    const handleRemoveOrderItem = (productIdToRemove) => {
        setOrderItems(orderItems.filter(item => item.productId !== productIdToRemove));
        toast.info(`Item removed from order.`);
    };

     const handleQuantityChange = (productId, newQuantity) => {
        const quantity = parseInt(newQuantity, 10);
        if (isNaN(quantity) || quantity < 1) {
             // Optionally remove if quantity becomes invalid, or just keep the old value
             toast.warn("Quantity must be at least 1.");
             return; // Or set quantity to 1
        }

        setOrderItems(orderItems.map(item =>
            item.productId === productId ? { ...item, quantity: quantity } : item
        ));
    };


    const handleCreateOrder = async (e) => {
        e.preventDefault();
        if (orderItems.length === 0) {
            toast.error('Cannot create an empty order. Please add items.');
            return;
        }

        setCreatingOrder(true);
        setCreateError(null);
        const config = getAuthConfig();
        const userId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);

        if (!config || !userId) {
            setCreateError('Authentication failed or user ID missing. Please log in again.');
            setCreatingOrder(false);
            toast.error('Authentication failed.');
            return;
        }

        const payload = {
            userId: userId, // Get logged-in user's ID from session storage
            orderItems: orderItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
            })),
        };

        try {
            const response = await axios.post(`${API_BASE_URL}/Orders`, payload, config);
            toast.success(`Order created successfully! Order ID: ${response.data.orderId}`);
            setOrderItems([]); // Clear the form
            // Optionally redirect to the order list or order detail page
            // history.push('/orders');
        } catch (err) {
            console.error('Error creating order:', err);
            const errorMsg = err.response?.data?.message || err.response?.data || err.message || 'Failed to create order.';
            setCreateError(errorMsg);
            toast.error(`Order creation failed: ${errorMsg}`);
        } finally {
            setCreatingOrder(false);
        }
    };

    // --- Render Logic ---
    if (loadingProducts) {
         return <div className="text-center my-5"><Spinner animation="border" /> Loading products...</div>;
    }
     if (productError) {
         return <Alert variant="danger">Error loading products: {productError}</Alert>;
    }

    return (
        <div className="container mt-4">
            <h2>Create New Order</h2>
            <ToastContainer position="top-right" autoClose={3000} />

            {createError && <Alert variant="danger">Error: {createError}</Alert>}

            <Form onSubmit={handleCreateOrder}>
                {/* Product Selection Row */}
                 <Row className="mb-3 align-items-end">
                    <Col md={6}>
                        <Form.Group controlId="productSelect">
                            <Form.Label>Select Product</Form.Label>
                            <Form.Select
                                value={selectedProductId}
                                onChange={(e) => setSelectedProductId(e.target.value)}
                                aria-label="Select product"
                            >
                                <option value="">-- Choose Product --</option>
                                {products.map(product => (
                                    <option key={product.productId} value={product.productId}>
                                        {product.name} (${product.price?.toFixed(2)}) - Stock: {product.stock}
                                    </option>
                                ))}
                            </Form.Select>
                             {/* Alternative using react-select for searchable dropdown:
                             <Select
                                 options={products.map(p => ({ value: p.productId, label: `${p.name} ($${p.price?.toFixed(2)}) - Stock: ${p.stock}` }))}
                                 onChange={(selectedOption) => setSelectedProductId(selectedOption ? selectedOption.value : '')}
                                 isClearable
                                 placeholder="Search or select a product..."
                             /> */}
                        </Form.Group>
                    </Col>
                    <Col md={3}>
                        <Form.Group controlId="quantityInput">
                            <Form.Label>Quantity</Form.Label>
                            <Form.Control
                                type="number"
                                min="1"
                                value={selectedQuantity}
                                onChange={(e) => setSelectedQuantity(parseInt(e.target.value, 10) || 1)}
                            />
                        </Form.Group>
                    </Col>
                    <Col md={3}>
                        <Button variant="primary" onClick={handleAddOrderItem} className="w-100">
                            Add Item
                        </Button>
                    </Col>
                </Row>

                {/* Order Items Table */}
                <h4 className="mt-4">Order Items</h4>
                {orderItems.length > 0 ? (
                     <div className="table-responsive">
                        <Table striped bordered hover size="sm">
                            <thead>
                                <tr>
                                    <th>Product Name</th>
                                    <th>Unit Price</th>
                                    <th>Quantity</th>
                                    <th>Subtotal</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orderItems.map(item => (
                                    <tr key={item.productId}>
                                        <td>{item.name || 'N/A'}</td>
                                        <td>${item.price?.toFixed(2) ?? '0.00'}</td>
                                        <td>
                                            <Form.Control
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => handleQuantityChange(item.productId, e.target.value)}
                                                style={{ width: '80px' }}
                                                size="sm"
                                            />
                                        </td>
                                         <td>${(item.price * item.quantity).toFixed(2)}</td>
                                        <td>
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={() => handleRemoveOrderItem(item.productId)}
                                            >
                                                Remove
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {/* Total Row */}
                                <tr>
                                    <td colSpan="3" className="text-end"><strong>Total:</strong></td>
                                    <td>
                                        <strong>
                                            ${orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                                        </strong>
                                        </td>
                                    <td></td>{/* Empty cell for actions column */}
                                </tr>
                            </tbody>
                        </Table>
                    </div>
                ) : (
                    <Alert variant="secondary">No items added to the order yet.</Alert>
                )}

                {/* Submit Button */}
                <div className="mt-4">
                    <Button
                        variant="success"
                        type="submit"
                        disabled={creatingOrder || orderItems.length === 0}
                        size="lg"
                    >
                        {creatingOrder ? (
                            <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Creating Order...</>
                        ) : (
                            'Create Order'
                        )}
                    </Button>
                </div>
            </Form>
        </div>
    );
}

export default CreateOrderForm;