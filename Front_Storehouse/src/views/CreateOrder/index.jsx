import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Form, Button, Table, Spinner, Alert, Row, Col } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';

// Define these constants if they are not imported from a central config
const API_BASE_URL = 'https://localhost:7204/api'; // Your backend API URL
const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    USER_ID: 'userId', // Key used to store the logged-in user's ID in session storage
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
    // REFRESH_TOKEN: 'refreshToken', // if you use it
};

// Auth config helper
const getAuthConfig = (contentType = 'application/json') => {
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
    return { headers };
};


function CreateOrderForm() {
    // State for product fetching and selection
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [productError, setProductError] = useState(null);
    const [orderItems, setOrderItems] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedQuantity, setSelectedQuantity] = useState(1);

    // State for order creation process
    const [creatingOrder, setCreatingOrder] = useState(false);
    const [createError, setCreateError] = useState(null);

    // State for Client and Shipping Address Info
    const [clientName, setClientName] = useState('');
    const [clientPhoneNumber, setClientPhoneNumber] = useState('');
    const [shippingAddressStreet, setShippingAddressStreet] = useState('');
    const [shippingAddressCity, setShippingAddressCity] = useState('');
    // const [shippingAddressState, setShippingAddressState] = useState(''); // Add if you have this field
    const [shippingAddressPostalCode, setShippingAddressPostalCode] = useState('');
    const [shippingAddressCountry, setShippingAddressCountry] = useState('');

    // Get the logged-in user's ID from session storage.
    // This will be sent as 'userId' in the payload to the backend.
    // It's not a state that changes via form input in this component.
    const orderForUserId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);

    // Fetch available products
    const fetchProducts = useCallback(async () => {
        setLoadingProducts(true);
        setProductError(null);
        const config = getAuthConfig();
        if (!config) {
            setProductError('Authentication token not found. Please log in.');
            setLoadingProducts(false);
            return;
        }
        try {
            // Ensure this endpoint exists and returns products
            const response = await axios.get(`${API_BASE_URL}/Product`, config);
            if (Array.isArray(response.data)) {
                 setProducts(response.data.filter(p => p.stock > 0)); // Only show products in stock
            } else {
                 console.error("Products API did not return an array:", response.data);
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

    // Add item to the current order list
    const handleAddOrderItem = () => {
        if (!selectedProductId) {
            toast.warn('Please select a product.');
            return;
        }
        if (selectedQuantity <= 0) {
            toast.warn('Quantity must be greater than 0.');
            return;
        }

        const product = products.find(p => p.productId === selectedProductId);
        if (!product) {
            toast.error('Selected product not found. Please refresh products.');
            return;
        }
         if (product.stock < selectedQuantity) {
            toast.error(`Not enough stock for ${product.name}. Available: ${product.stock}`);
            return;
        }


        const existingItemIndex = orderItems.findIndex(item => item.productId === selectedProductId);
        if (existingItemIndex > -1) {
            const updatedItems = [...orderItems];
            const newQuantityForExisting = updatedItems[existingItemIndex].quantity + selectedQuantity;
             if (product.stock < newQuantityForExisting) {
                toast.error(`Cannot add more ${product.name}. Total requested (${newQuantityForExisting}) exceeds stock (${product.stock}).`);
                return;
            }
            updatedItems[existingItemIndex].quantity = newQuantityForExisting;
            setOrderItems(updatedItems);
            toast.info(`Updated quantity for ${product.name}.`);
        } else {
            setOrderItems([
                ...orderItems,
                {
                    productId: selectedProductId,
                    quantity: selectedQuantity,
                    name: product.name, // For display in the table
                    price: product.price // For display and subtotal calculation
                }
            ]);
            toast.success(`${product.name} added to order.`);
        }
        setSelectedProductId(''); // Reset product selection
        setSelectedQuantity(1);   // Reset quantity
    };

    // Remove item from the current order list
    const handleRemoveOrderItem = (productIdToRemove) => {
        setOrderItems(orderItems.filter(item => item.productId !== productIdToRemove));
        toast.info(`Item removed from order.`);
    };

    // Handle quantity change in the order items table
    const handleQuantityChange = (productId, newQuantityStr) => {
        const newQuantity = parseInt(newQuantityStr, 10);
        const productInOrder = orderItems.find(item => item.productId === productId);
        const originalProduct = products.find(p => p.productId === productId);


        if (isNaN(newQuantity) || newQuantity < 1) {
            toast.warn("Quantity must be at least 1.");
            // Optionally revert to old quantity or remove item if quantity is invalid
            // For now, we'll just prevent the update for invalid input
            return;
        }

         if (originalProduct && newQuantity > originalProduct.stock) {
            toast.error(`Cannot set quantity for ${originalProduct.name} to ${newQuantity}. Available stock: ${originalProduct.stock}.`);
            // Optionally set to max stock or keep previous valid quantity
            // For now, prevent update beyond stock
            return;
        }


        setOrderItems(orderItems.map(item =>
            item.productId === productId ? { ...item, quantity: newQuantity } : item
        ));
    };

    // Handle the order creation submission
    const handleCreateOrder = async (e) => {
        e.preventDefault();

        if (orderItems.length === 0) {
            toast.error('Cannot create an empty order. Please add items.');
            return;
        }
        if (!orderForUserId) {
            toast.error('User ID for the order is missing. Please ensure you are logged in.');
            setCreateError('User ID for order not found.');
            return;
        }
        // Basic validation for client and shipping info
        if (!clientName.trim()) { toast.error('Client Name is required.'); return; }
        if (!shippingAddressStreet.trim()) { toast.error('Shipping Street is required.'); return; }
        if (!shippingAddressCity.trim()) { toast.error('Shipping City is required.'); return; }
        if (!shippingAddressPostalCode.trim()) { toast.error('Shipping Postal Code is required.'); return; }
        if (!shippingAddressCountry.trim()) { toast.error('Shipping Country is required.'); return; }


        setCreatingOrder(true);
        setCreateError(null);
        const config = getAuthConfig();

        if (!config) {
            // Error already toasted by getAuthConfig
            setCreateError('Authentication failed. Please log in again.');
            setCreatingOrder(false);
            return;
        }

        const payload = {
            userId: orderForUserId, // This is the ID from sessionStorage (logged-in user)
            orderItems: orderItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
            })),
            clientName: clientName,
            clientPhoneNumber: clientPhoneNumber || null, // Send null if empty
            shippingAddressStreet: shippingAddressStreet,
            shippingAddressCity: shippingAddressCity,
            // shippingAddressState: shippingAddressState || null, // Send null if empty
            shippingAddressPostalCode: shippingAddressPostalCode,
            shippingAddressCountry: shippingAddressCountry,
        };
        console.log("Submitting Order - Payload:", payload);

        try {
            const response = await axios.post(`${API_BASE_URL}/Orders`, payload, config);
            toast.success(`Order created successfully! Order ID: ${response.data.orderId}`);
            // Clear form fields after successful creation
            setOrderItems([]);
            setClientName('');
            setClientPhoneNumber('');
            setShippingAddressStreet('');
            setShippingAddressCity('');
            // setShippingAddressState('');
            setShippingAddressPostalCode('');
            setShippingAddressCountry('');
            setSelectedProductId('');
            setSelectedQuantity(1);
            // orderForUserId is from session, no need to clear it from component state
            // Optionally redirect to order list or detail page
        } catch (err) {
            console.error('Error creating order:', err.response || err);
            const errorData = err.response?.data;
            let errorMsg = "Failed to create order.";
            if (typeof errorData === 'string') {
                errorMsg = errorData;
            } else if (errorData?.message) {
                errorMsg = errorData.message;
                if(errorData.detail) errorMsg += ` Details: ${errorData.detail}`;
            } else if (err.message) {
                errorMsg = err.message;
            }
            setCreateError(errorMsg);
            toast.error(`Order creation failed: ${errorMsg}`);
        } finally {
            setCreatingOrder(false);
        }
    };

    // Render logic
    if (loadingProducts) {
         return <div className="text-center my-5"><Spinner animation="border" /> Loading products...</div>;
    }
    if (productError) {
         return <Alert variant="danger">Error loading products: {productError}</Alert>;
    }

    return (
        <div className="container mt-4">
            <h2>Create New Order</h2>
            <ToastContainer position="top-right" autoClose={3000} newestOnTop />

            {createError && <Alert variant="danger" onClose={() => setCreateError(null)} dismissible>Order Creation Error: {createError}</Alert>}

            <Form onSubmit={handleCreateOrder}>
                {/* Optionally display who the order is for, if helpful */}
                {/* <Alert variant="light" className="mb-3">Order will be created for User ID: <strong>{orderForUserId || "N/A (Please ensure you are logged in)"}</strong></Alert> */}

                {/* Client Information Section */}
                <h4 className="mt-3">Client Information</h4>
                <Row className="mb-3">
                    <Col md={6}>
                        <Form.Group controlId="clientName">
                            <Form.Label>Client Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter client's full name"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                required
                            />
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group controlId="clientPhoneNumber">
                            <Form.Label>Client Phone Number</Form.Label>
                            <Form.Control
                                type="tel"
                                placeholder="Enter client's phone number"
                                value={clientPhoneNumber}
                                onChange={(e) => setClientPhoneNumber(e.target.value)}
                            />
                        </Form.Group>
                    </Col>
                </Row>
                <hr />

                {/* Shipping Address Section */}
                <h4>Shipping Address</h4>
                <Row className="mb-3">
                    <Col md={12}>
                        <Form.Group controlId="shippingStreet">
                            <Form.Label>Street <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="123 Main St"
                                value={shippingAddressStreet}
                                onChange={(e) => setShippingAddressStreet(e.target.value)}
                                required
                            />
                        </Form.Group>
                    </Col>
                </Row>
                <Row className="mb-3">
                    <Col md={4}>
                        <Form.Group controlId="shippingCity">
                            <Form.Label>City <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Anytown"
                                value={shippingAddressCity}
                                onChange={(e) => setShippingAddressCity(e.target.value)}
                                required
                            />
                        </Form.Group>
                    </Col>
                    {/* <Col md={3}> // Uncomment if you add ShippingAddressState
                        <Form.Group controlId="shippingState">
                            <Form.Label>State</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="CA"
                                value={shippingAddressState}
                                onChange={(e) => setShippingAddressState(e.target.value)}
                            />
                        </Form.Group>
                    </Col> */}
                    <Col md={4}>
                        <Form.Group controlId="shippingPostalCode">
                            <Form.Label>Postal Code <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="12345"
                                value={shippingAddressPostalCode}
                                onChange={(e) => setShippingAddressPostalCode(e.target.value)}
                                required
                            />
                        </Form.Group>
                    </Col>
                     <Col md={4}>
                        <Form.Group controlId="shippingCountry">
                            <Form.Label>Country <span className="text-danger">*</span></Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="USA"
                                value={shippingAddressCountry}
                                onChange={(e) => setShippingAddressCountry(e.target.value)}
                                required
                            />
                        </Form.Group>
                    </Col>
                </Row>
                <hr />

                {/* Product Selection and Items Table Section */}
                <h4>Order Items <span className="text-danger">*</span></h4>
                 <Row className="mb-3 align-items-end">
                    <Col md={5}> {/* Adjusted Col width */}
                        <Form.Group controlId="productSelect">
                            <Form.Label>Select Product</Form.Label>
                            <Form.Select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} aria-label="Select product">
                                <option value="">-- Choose Product --</option>
                                {products.map(product => (
                                    <option key={product.productId} value={product.productId}>
                                        {product.name} (${product.price?.toFixed(2)}) - Stock: {product.stock}
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={3}> {/* Adjusted Col width */}
                        <Form.Group controlId="quantityInput">
                            <Form.Label>Quantity</Form.Label>
                            <Form.Control type="number" min="1" value={selectedQuantity} onChange={(e) => setSelectedQuantity(parseInt(e.target.value, 10) || 1)} />
                        </Form.Group>
                    </Col>
                    <Col md={4} className="d-flex align-items-end"> {/* Adjusted Col width */}
                        <Button variant="info" onClick={handleAddOrderItem} className="w-100">
                            Add Item to Order
                        </Button>
                    </Col>
                </Row>

                {/* Order Items Table */}
                {orderItems.length > 0 && (
                     <div className="table-responsive mt-3">
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
                                    <td colSpan="3" className="text-end fs-5"><strong>Total:</strong></td>
                                    <td className="fs-5">
                                        <strong>
                                            ${orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                                        </strong>
                                    </td>
                                    <td></td> {/* Empty cell for actions column */}
                                </tr>
                            </tbody>
                        </Table>
                    </div>
                )}
                {orderItems.length === 0 && <Alert variant="secondary" className="mt-3">No items added to the order yet. Please add at least one item.</Alert>}


                {/* Submit Button */}
                <div className="mt-4 d-grid">
                    <Button
                        variant="success"
                        type="submit"
                        disabled={creatingOrder || orderItems.length === 0}
                        size="lg"
                    >
                        {creatingOrder ? (
                            <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Creating Order...</>
                        ) : (
                            'Place Order'
                        )}
                    </Button>
                </div>
            </Form>
        </div>
    );
}

export default CreateOrderForm;