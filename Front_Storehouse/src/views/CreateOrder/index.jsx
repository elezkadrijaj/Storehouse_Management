import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Table, Spinner, Alert, Row, Col } from 'react-bootstrap';
import { ToastContainer, toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';
import apiClient from '../../appService';

const SESSION_STORAGE_KEYS = {
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
};

function CreateOrderForm() {
    // All state hooks remain the same.
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [productError, setProductError] = useState(null);
    const [orderItems, setOrderItems] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedQuantity, setSelectedQuantity] = useState(1);
    const [creatingOrder, setCreatingOrder] = useState(false);
    const [createError, setCreateError] = useState(null);
    const [clientName, setClientName] = useState('');
    const [clientPhoneNumber, setClientPhoneNumber] = useState('');
    const [shippingAddressStreet, setShippingAddressStreet] = useState('');
    const [shippingAddressCity, setShippingAddressCity] = useState('');
    const [shippingAddressPostalCode, setShippingAddressPostalCode] = useState('');
    const [shippingAddressCountry, setShippingAddressCountry] = useState('');
    const orderForUserId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID);

    const fetchProducts = useCallback(async () => {
        setLoadingProducts(true);
        setProductError(null);
        try {
            const response = await apiClient.get('/Product');
            if (Array.isArray(response.data)) {
                 setProducts(response.data.filter(p => p.stock > 0));
            } else {
                 setProductError("API returned unexpected data for products.");
            }
        } catch (err) {
            setProductError(err.response?.data?.message || 'Failed to load products.');
        } finally {
            setLoadingProducts(false);
        }
    }, []);

    useEffect(() => {
        const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
        if (!userRole) {
            setProductError("You are not logged in. Please log in to create an order.");
            setLoadingProducts(false);
            return;
        }
        fetchProducts();
    }, [fetchProducts]);

    // --- START OF FIX ---
    const handleAddOrderItem = () => {
        if (!selectedProductId) {
            toast.warn('Please select a product.');
            return;
        }
        const quantity = Number(selectedQuantity);
        if (quantity <= 0) {
            toast.warn('Quantity must be greater than 0.');
            return;
        }

        // FIX: REMOVED the incorrect parseInt(). We are now comparing a string to a string.
        const product = products.find(p => p.productId === selectedProductId);
        
        if (!product) {
            toast.error('Selected product not found. Please refresh products.');
            return;
        }
        if (product.stock < quantity) {
            toast.error(`Not enough stock for ${product.name}. Available: ${product.stock}`);
            return;
        }

        // The 'find' condition now correctly uses the string ID.
        const existingItemIndex = orderItems.findIndex(item => item.productId === selectedProductId);
        if (existingItemIndex > -1) {
            const updatedItems = [...orderItems];
            const newQuantityForExisting = updatedItems[existingItemIndex].quantity + quantity;
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
                    // FIX: Use the original string ID.
                    productId: selectedProductId, 
                    quantity: quantity,
                    name: product.name,
                    price: product.price
                }
            ]);
            toast.success(`${product.name} added to order.`);
        }
        setSelectedProductId('');
        setSelectedQuantity(1);
    };
    // --- END OF FIX ---

    const handleRemoveOrderItem = (productIdToRemove) => {
        setOrderItems(orderItems.filter(item => item.productId !== productIdToRemove));
        toast.info(`Item removed from order.`);
    };

    const handleQuantityChange = (productId, newQuantityStr) => {
        const newQuantity = parseInt(newQuantityStr, 10);
        const originalProduct = products.find(p => p.productId === productId);

        if (isNaN(newQuantity) || newQuantity < 1) {
            toast.warn("Quantity must be at least 1.");
            return;
        }
        if (originalProduct && newQuantity > originalProduct.stock) {
            toast.error(`Cannot set quantity for ${originalProduct.name} to ${newQuantity}. Available stock: ${originalProduct.stock}.`);
            return;
        }

        setOrderItems(orderItems.map(item =>
            item.productId === productId ? { ...item, quantity: newQuantity } : item
        ));
    };

    const handleCreateOrder = async (e) => {
        e.preventDefault();
        if (orderItems.length === 0) { toast.error('Cannot create an empty order.'); return; }
        if (!orderForUserId) { toast.error('User ID is missing. Please log in again.'); return; }
        if (!clientName.trim() || !shippingAddressStreet.trim() || !shippingAddressCity.trim() || !shippingAddressPostalCode.trim() || !shippingAddressCountry.trim()) {
            toast.error('Please fill all required client and shipping fields.');
            return;
        }

        setCreatingOrder(true);
        setCreateError(null);

        const payload = {
            userId: orderForUserId,
            orderItems: orderItems.map(item => ({ productId: item.productId, quantity: item.quantity })),
            clientName, clientPhoneNumber: clientPhoneNumber || null,
            shippingAddressStreet, shippingAddressCity,
            shippingAddressPostalCode, shippingAddressCountry,
        };

        try {
            const response = await apiClient.post('/Orders', payload);
            toast.success(`Order created successfully! Order ID: ${response.data.orderId}`);
            setOrderItems([]); setClientName(''); setClientPhoneNumber('');
            setShippingAddressStreet(''); setShippingAddressCity('');
            setShippingAddressPostalCode(''); setShippingAddressCountry('');
            setSelectedProductId(''); setSelectedQuantity(1);
        } catch (err) {
            const errorMsg = err.response?.data?.message || "Failed to create order.";
            setCreateError(errorMsg);
            toast.error(`Order creation failed: ${errorMsg}`);
        } finally {
            setCreatingOrder(false);
        }
    };

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
                <h4 className="mt-3">Client Information</h4>
                <Row className="mb-3">
                    <Col md={6}><Form.Group><Form.Label>Client Name <span className="text-danger">*</span></Form.Label><Form.Control type="text" placeholder="Enter client's full name" value={clientName} onChange={(e) => setClientName(e.target.value)} required /></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label>Client Phone Number</Form.Label><Form.Control type="tel" placeholder="Enter client's phone number" value={clientPhoneNumber} onChange={(e) => setClientPhoneNumber(e.target.value)} /></Form.Group></Col>
                </Row>
                <hr />
                <h4>Shipping Address</h4>
                <Row className="mb-3"><Col md={12}><Form.Group><Form.Label>Street <span className="text-danger">*</span></Form.Label><Form.Control type="text" placeholder="123 Main St" value={shippingAddressStreet} onChange={(e) => setShippingAddressStreet(e.target.value)} required /></Form.Group></Col></Row>
                <Row className="mb-3">
                    <Col md={4}><Form.Group><Form.Label>City <span className="text-danger">*</span></Form.Label><Form.Control type="text" placeholder="Anytown" value={shippingAddressCity} onChange={(e) => setShippingAddressCity(e.target.value)} required /></Form.Group></Col>
                    <Col md={4}><Form.Group><Form.Label>Postal Code <span className="text-danger">*</span></Form.Label><Form.Control type="text" placeholder="12345" value={shippingAddressPostalCode} onChange={(e) => setShippingAddressPostalCode(e.target.value)} required /></Form.Group></Col>
                    <Col md={4}><Form.Group><Form.Label>Country <span className="text-danger">*</span></Form.Label><Form.Control type="text" placeholder="USA" value={shippingAddressCountry} onChange={(e) => setShippingAddressCountry(e.target.value)} required /></Form.Group></Col>
                </Row>
                <hr />
                <h4>Order Items <span className="text-danger">*</span></h4>
                <Row className="mb-3 align-items-end">
                    <Col md={5}><Form.Group><Form.Label>Select Product</Form.Label><Form.Select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}><option value="">-- Choose Product --</option>{products.map(product => (<option key={product.productId} value={product.productId}>{product.name} (${product.price?.toFixed(2)}) - Stock: {product.stock}</option>))}</Form.Select></Form.Group></Col>
                    <Col md={3}><Form.Group><Form.Label>Quantity</Form.Label><Form.Control type="number" min="1" value={selectedQuantity} onChange={(e) => setSelectedQuantity(e.target.value)} /></Form.Group></Col>
                    <Col md={4} className="d-flex align-items-end"><Button variant="info" onClick={handleAddOrderItem} className="w-100">Add Item to Order</Button></Col>
                </Row>
                {orderItems.length > 0 && (
                     <div className="table-responsive mt-3">
                        <Table striped bordered hover size="sm">
                            <thead><tr><th>Product Name</th><th>Unit Price</th><th>Quantity</th><th>Subtotal</th><th>Actions</th></tr></thead>
                            <tbody>
                                {orderItems.map(item => (
                                    <tr key={item.productId}>
                                        <td>{item.name || 'N/A'}</td><td>${item.price?.toFixed(2) ?? '0.00'}</td>
                                        <td><Form.Control type="number" min="1" value={item.quantity} onChange={(e) => handleQuantityChange(item.productId, e.target.value)} style={{ width: '80px' }} size="sm" /></td>
                                        <td>${(item.price * item.quantity).toFixed(2)}</td>
                                        <td><Button variant="danger" size="sm" onClick={() => handleRemoveOrderItem(item.productId)}>Remove</Button></td>
                                    </tr>
                                ))}
                                <tr>
                                    <td colSpan="3" className="text-end fs-5"><strong>Total:</strong></td>
                                    <td className="fs-5"><strong>${orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}</strong></td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </Table>
                    </div>
                )}
                {orderItems.length === 0 && <Alert variant="secondary" className="mt-3">No items added to the order yet.</Alert>}
                <div className="mt-4 d-grid">
                    <Button variant="success" type="submit" disabled={creatingOrder || orderItems.length === 0} size="lg">
                        {creatingOrder ? <><Spinner as="span" animation="border" size="sm" /> Creating Order...</> : 'Place Order'}
                    </Button>
                </div>
            </Form>
        </div>
    );
}

export default CreateOrderForm;