// src/components/ProductManagement.js (adjust path as needed)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils'; // Adjust path
import { Form, Button, Modal, Card, Row, Col, Alert, Spinner } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE_URL = 'https://localhost:7204/api'; 

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken', 
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

// Helper to format date for input type="date" (YYYY-MM-DD)
const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        // Adjust for timezone offset to get correct local date YYYY-MM-DD
        const offset = date.getTimezoneOffset();
        const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
        return adjustedDate.toISOString().split('T')[0];
    } catch (e) {
        console.error("Error formatting date:", e);
        return '';
    }
};

function ProductManagement() {
    const [searchParams] = useSearchParams();
    const storehouseId = searchParams.get('storehouseId');
    
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [productError, setProductError] = useState(null);

    // --- State for Dependencies ---
    const [suppliers, setSuppliers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [sections, setSections] = useState([]);
    const [loadingDependencies, setLoadingDependencies] = useState(true);
    const [dependencyError, setDependencyError] = useState(null);
    const [storehouseName, setStorehouseName] = useState('');

    // --- State for Filtering ---
    const [selectedSectionId, setSelectedSectionId] = useState('all'); // 'all' or section ID

    // --- State for Create Modal ---
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProduct, setNewProduct] = useState({
        name: '', stock: '', expiryDate: '', price: '', supplierId: '', categoryId: '', sectionId: '' // <-- Added sectionId
    });
    const [photoFile, setPhotoFile] = useState(null); // <-- State for the photo file
    const createFormRef = useRef(null); // Ref for resetting form

    // --- State for Edit Modal ---
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null); // Will hold the product being edited

    // --- State for Delete operation ---
    const [deletingProductId, setDeletingProductId] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);


    // --- Auth Header Helper ---
    // (Separate function for JSON vs FormData below)
    const getAuthToken = useCallback(() => {
        const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
        if (!token) {
            toast.error('Authentication token not found. Please log in.');
            // Set error states to prevent proceeding
            setProductError('Authentication token not found.');
            setDependencyError('Authentication token notfound.');
            setLoadingProducts(false);
            setLoadingDependencies(false);
            return null;
        }
        return token;
    }, []);

    const getAuthConfig = useCallback((contentType = 'application/json') => {
        const token = getAuthToken();
        if (!token) return null;
        return {
            headers: {
                Authorization: `Bearer ${token}`,
                ...(contentType && { 'Content-Type': contentType }), // Conditionally add Content-Type
            }
        };
    }, [getAuthToken]);

    // --- Fetching Dependencies (Suppliers, Categories, Sections) ---
    const fetchDependencies = useCallback(async (isMounted) => {
        setLoadingDependencies(true);
        setDependencyError(null);
        const token = getAuthToken();
        if (!token) return;

        const config = { headers: { Authorization: `Bearer ${token}` } };

        try {
            // Only fetch sections if we have a valid storehouseId
            if (storehouseId) {
                const [storehouseRes, sectionsRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/Storehouses/${storehouseId}`, config).catch(err => {
                        console.error("Error fetching storehouse:", err);
                        return { data: null, error: true, message: err.response?.data?.message || err.message || 'Failed to load storehouse.' };
                    }),
                    axios.get(`${API_BASE_URL}/Storehouses/${storehouseId}/Sections`, config).catch(err => {
                        console.error("Error fetching sections:", err);
                        return { data: null, error: true, message: err.response?.data?.message || err.message || 'Failed to load sections.' };
                    })
                ]);

                if (isMounted) {
                    if (storehouseRes && !storehouseRes.error) {
                        setStorehouseName(storehouseRes.data.storehouseName);
                    }
                    if (sectionsRes && !sectionsRes.error && Array.isArray(sectionsRes.data)) {
                        setSections(sectionsRes.data);
                    } else {
                        setSections([]);
                        setDependencyError(sectionsRes?.message || 'Failed to load sections.');
                    }
                }
            } else {
                setSections([]);
                setStorehouseName('');
            }

            // Fetch suppliers and categories
            const [suppliersResponse, categoriesResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/Suppliers`, config).catch(err => {
                    console.error("Error fetching suppliers:", err);
                    return { data: null, error: true, message: err.response?.data?.message || err.message || 'Failed to load suppliers.' };
                }),
                axios.get(`${API_BASE_URL}/Categories`, config).catch(err => {
                    console.error("Error fetching categories:", err);
                    return { data: null, error: true, message: err.response?.data?.message || err.message || 'Failed to load categories.' };
                })
            ]);

            if (isMounted) {
                // Process Suppliers
                if (suppliersResponse && !suppliersResponse.error && Array.isArray(suppliersResponse.data)) {
                    setSuppliers(suppliersResponse.data);
                } else {
                    setSuppliers([]);
                    setDependencyError(prev => prev ? prev + '\n' + (suppliersResponse?.message || 'Failed to load suppliers.') : suppliersResponse?.message || 'Failed to load suppliers.');
                }

                // Process Categories
                if (categoriesResponse && !categoriesResponse.error && Array.isArray(categoriesResponse.data)) {
                    setCategories(categoriesResponse.data);
                } else {
                    setCategories([]);
                    setDependencyError(prev => prev ? prev + '\n' + (categoriesResponse?.message || 'Failed to load categories.') : categoriesResponse?.message || 'Failed to load categories.');
                }
            }
        } catch (err) {
            if (isMounted) {
                console.error("General error fetching dependencies:", err);
                setDependencyError('An unexpected error occurred fetching dependencies.');
                setSuppliers([]);
                setCategories([]);
                setSections([]);
                setStorehouseName('');
            }
        } finally {
            if (isMounted) {
                setLoadingDependencies(false);
            }
        }
    }, [getAuthToken, storehouseId]);

    // --- Fetching Products (All or by Section) ---
    const fetchProducts = useCallback(async (isMounted, sectionId) => {
        setLoadingProducts(true);
        setProductError(null);
        const token = getAuthToken();
        if (!token) return; // Stop if no token

        const config = { headers: { Authorization: `Bearer ${token}` } };
        let url = `${API_BASE_URL}/Product`; // Default: fetch all

        if (sectionId && sectionId !== 'all') {
            // IMPORTANT: Use the correct endpoint structure from your C# controller
            // Assuming it's /api/Section/{sectionId}/Products based on your example
            url = `${API_BASE_URL}/Section/${sectionId}/Products`;
        }
        console.log("Fetching products from URL:", url); // Debugging

        try {
            const response = await axios.get(url, config);
            if (isMounted) {
                if (response && Array.isArray(response.data)) {
                    // The API now returns products with Supplier/Category/Section populated if fetched by section
                    setProducts(response.data);
                } else {
                    console.error("Products API did not return an array:", response?.data);
                    setProductError("Failed to load products: API returned unexpected data.");
                    setProducts([]);
                }
            }
        } catch (err) {
            if (isMounted) {
                console.error(`Error fetching products (Section: ${sectionId}):`, err);
                const errorMsg = err.response?.data?.message || err.response?.data || err.message || 'Failed to load products.';
                // Handle 404 specifically if fetching by section
                if (err.response?.status === 404 && sectionId !== 'all') {
                    setProductError(`Section with ID ${sectionId} not found or has no products.`);
                } else {
                    setProductError(errorMsg);
                }
                setProducts([]); // Clear products on error
            }
        } finally {
            if (isMounted) {
                setLoadingProducts(false);
            }
        }
    }, [getAuthToken]); // Dependency: how we get the token

    // --- Effects ---
    useEffect(() => {
        let isMounted = true;
        // Fetch dependencies once on mount (or when token is available)
        fetchDependencies(isMounted);
        return () => { isMounted = false; }; // Cleanup
    }, [fetchDependencies]); // Re-run if fetchDependencies changes

    useEffect(() => {
        let isMounted = true;
        // Fetch products whenever the selected section changes (or on initial load)
        // Also wait for dependencies to load before fetching products
        if (!loadingDependencies) {
            fetchProducts(isMounted, selectedSectionId);
        }
        return () => { isMounted = false; }; // Cleanup
    }, [selectedSectionId, fetchProducts, loadingDependencies]); // Dependencies

    // --- Section Filter Handler ---
    const handleSectionChange = (e) => {
        setSelectedSectionId(e.target.value); // This triggers the useEffect to fetch products
    };

    // --- Create Modal Handlers ---
    const handleOpenCreateModal = () => {

        // Reset form state
        setNewProduct({
            name: '',
            stock: '',
            expiryDate: '',
            price: '',
            supplierId: '',
            categoryId: '',
            sectionId: ''
        });
        setPhotoFile(null);
        if (createFormRef.current) {
            createFormRef.current.reset();
        }
        setShowCreateModal(true);
    };

    const handleCloseCreateModal = () => {
        setShowCreateModal(false);
        // Reset form state when closing
        setNewProduct({
            name: '',
            stock: '',
            expiryDate: '',
            price: '',
            supplierId: '',
            categoryId: '',
            sectionId: ''
        });
        setPhotoFile(null);
    };

    const handleCreateInputChange = (e) => {
        const { name, value } = e.target;
        setNewProduct(prev => ({ ...prev, [name]: value }));
    };

    const handlePhotoFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setPhotoFile(e.target.files[0]);
        } else {
            setPhotoFile(null);
        }
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        const { name, stock, expiryDate, price, supplierId, categoryId, sectionId } = newProduct;

        // Validation
        if (!name.trim() || !stock.trim() || !expiryDate || !price || !supplierId || !categoryId) {
            toast.warn('Please fill in all required fields (Name, Stock, Expiry, Price, Supplier, Category).');
            return;
        }
        if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
            toast.warn('Please enter a valid non-negative price.');
            return;
        }

        const token = getAuthToken();
        if (!token) return;

        // Use FormData
        const formData = new FormData();
        formData.append('Name', name.trim());
        formData.append('Stock', stock.trim());
        formData.append('ExpiryDate', expiryDate);
        formData.append('Price', parseFloat(price));
        formData.append('SupplierId', supplierId);
        formData.append('CategoryId', categoryId);
        if (sectionId) {
            formData.append('SectionId', parseInt(sectionId, 10));
        }
        if (photoFile) {
            formData.append('PhotoFile', photoFile);
        }

        const config = getAuthConfig(null);
        if (!config) return;

        try {
            const response = await axios.post(`${API_BASE_URL}/Product`, formData, config);
            toast.success('Product created successfully!');

            // Update the products list
            const newProdId = response.data.productId;
            if (newProdId) {
                try {
                    const singleProductConfig = getAuthConfig();
                    const newProductDetails = await axios.get(`${API_BASE_URL}/Product/${newProdId}`, singleProductConfig);
                    if (newProductDetails.data) {
                        if (selectedSectionId === 'all' || newProductDetails.data.sectionId?.toString() === selectedSectionId) {
                            setProducts(prev => [...prev, newProductDetails.data]);
                        }
                    }
                } catch (fetchErr) {
                    console.error("Error fetching newly created product details:", fetchErr);
                    fetchProducts(true, selectedSectionId);
                }
            } else {
                fetchProducts(true, selectedSectionId);
            }

            handleCloseCreateModal();
        } catch (err) {
            console.error("Create Product Error:", err);
            const errorData = err.response?.data;
            let errorMessage = 'Error creating product.';
            if (typeof errorData === 'string') {
                errorMessage = errorData;
            } else if (errorData?.title) {
                errorMessage = errorData.title;
                if (errorData.errors) {
                    errorMessage += ': ' + Object.values(errorData.errors).flat().join(' ');
                }
            } else if (errorData?.message) {
                errorMessage = errorData.message;
            } else if (err.message) {
                errorMessage = err.message;
            }
            toast.error(errorMessage);
        }
    };

    const [isUpdating, setIsUpdating] = useState(false);

    // --- Edit Modal Handlers ---
    const handleOpenEditModal = (product) => {
        // Find the full supplier, category, and section objects for display (already done in list)
        // But ensure the IDs are correctly set for the form state
        setEditingProduct({
            ...product,
            expiryDate: formatDateForInput(product.expiryDate), // Format for input type="date"
            price: product.price?.toString() ?? '', // Ensure price is a string for the input
            // Ensure IDs are strings for the select dropdowns, handle potential nulls
            supplierId: product.supplierId ?? '',
            categoryId: product.categoryId ?? '',
            sectionId: product.sectionId?.toString() ?? '', // Convert number to string for select, or empty string if null/undefined
        });
        setShowEditModal(true);
    };
    const handleCloseEditModal = () => {
        setShowEditModal(false);
        setEditingProduct(null);
        setIsUpdating(false); // Reset updating state on close
    };
    
    const handleEditInputChange = (e) => {
        if (!editingProduct) return;
        const { name, value } = e.target;
        setEditingProduct(prev => ({ ...prev, [name]: value }));
    };
    
    const handleUpdateSubmit = async (e) => {
        e.preventDefault(); // Prevent default form submission
        if (!editingProduct) {
            toast.error("No product selected for editing.");
            return;
        }
    
        setIsUpdating(true); // Set loading state for the button
    
        const { productId, name, stock, expiryDate, price, photo, supplierId, categoryId, sectionId } = editingProduct;
    
        // --- Validation ---
        if (!name.trim() || !stock.toString().trim() || !expiryDate || !price.toString().trim() || !supplierId || !categoryId) {
            toast.warn('Please fill in all required fields (Name, Stock, Expiry, Price, Supplier, Category).');
            setIsUpdating(false);
            return;
        }
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            toast.warn('Please enter a valid non-negative price.');
            setIsUpdating(false);
            return;
        }
        const parsedStock = parseFloat(stock);
         if (isNaN(parsedStock)) { // Stock can be zero or negative depending on logic, just check if it's a number
            toast.warn('Please enter a valid number for stock.');
            setIsUpdating(false);
            return;
        }
        // Validate sectionId if selected (it should be a number string or empty)
        let parsedSectionId = null;
        if (sectionId && sectionId !== '') {
            parsedSectionId = parseInt(sectionId, 10);
            if (isNaN(parsedSectionId)) {
                toast.warn('Invalid Section ID selected.');
                setIsUpdating(false);
                return;
            }
        }
    
        // --- Prepare Payload ---
        // Ensure data types match the backend C# model for ReplaceOneAsync
        const updatedProductData = {
            productId: productId, // Crucial: Include the ID for ReplaceOneAsync
            name: name.trim(),
            stock: parsedStock, // Send as number
            expiryDate: expiryDate, // Send as "YYYY-MM-DD" string, backend should handle parsing
            price: parsedPrice,   // Send as number
            photo: photo,         // Send existing photo path to keep it
            supplierId: supplierId,
            categoryId: categoryId,
            sectionId: parsedSectionId // Send as number or null
        };
    
        // --- Get Auth Config ---
        const config = getAuthConfig('application/json'); // Need JSON content type
        if (!config) {
            toast.error('Authentication failed. Please log in again.');
            setIsUpdating(false);
            return;
        }
    
        // --- API Call ---
        try {
            await axios.put(`${API_BASE_URL}/Product/${productId}`, updatedProductData, config);
    
            toast.success('Product updated successfully!');
    
            // --- Update Local State ---
            // Find the supplier/category/section names for the updated row display
            const updatedSupplier = suppliers.find(s => s.supplierId === supplierId);
            const updatedCategory = categories.find(c => c.categoryId === categoryId);
            const updatedSection = sections.find(sec => sec.sectionId === parsedSectionId);
    
            setProducts(prevProducts =>
                prevProducts.map(p =>
                    p.productId === productId
                    ? { // Create the updated product object for the local state
                          ...p, // Spread existing properties first
                          ...updatedProductData, // Spread the updated data from payload
                          // Update the related *objects* used for display in the table
                          supplier: updatedSupplier ? { ...updatedSupplier } : { supplierId: supplierId, name: 'N/A' }, // Handle if supplier not found
                          category: updatedCategory ? { ...updatedCategory } : { categoryId: categoryId, name: 'N/A' }, // Handle if category not found
                          section: updatedSection ? { ...updatedSection } : null, // Handle if section not found or null
                          // Ensure expiryDate is in a Date object format if needed elsewhere,
                          // but keep the string for consistency with backend if not manipulating it client-side post-update
                          expiryDate: updatedProductData.expiryDate, // Keep string from form or re-parse: new Date(updatedProductData.expiryDate)
                      }
                    : p // Keep other products unchanged
                )
            );
    
            handleCloseEditModal(); // Close modal on success
    
        } catch (err) {
            console.error("Update Product Error:", err);
            const errorData = err.response?.data;
            let errorMessage = 'Error updating product.';
            if (typeof errorData === 'string') {
                errorMessage = errorData;
            } else if (errorData?.title) {
                errorMessage = errorData.title;
                if (errorData.errors) {
                    errorMessage += ': ' + Object.values(errorData.errors).flat().join(' ');
                }
            } else if (errorData?.message) {
                errorMessage = errorData.message;
            } else if (err.message) {
                errorMessage = err.message;
            }
            toast.error(errorMessage);
        } finally {
            setIsUpdating(false); // Ensure loading state is turned off
        }
    };
    // --- Delete Handlers ---
    const handleShowDeleteModal = (product) => {
        setProductToDelete(product);
        setShowDeleteModal(true);
    };

    const handleCloseDeleteModal = () => {
        setShowDeleteModal(false);
        setProductToDelete(null);
    };

    const handleDeleteProduct = async () => {
        if (!productToDelete) return;

        setDeletingProductId(productToDelete.productId);
        const config = getAuthConfig();
        if (!config) {
            setDeletingProductId(null);
            return;
        }

        try {
            await axios.delete(`${API_BASE_URL}/Product/${productToDelete.productId}`, config);
            toast.success('Product deleted successfully!');
            setProducts(prevProducts => prevProducts.filter((product) => product.productId !== productToDelete.productId));
            handleCloseDeleteModal();
        } catch (err) {
            console.error('Delete Product Error:', err);
            toast.error(err.response?.data?.message || err.response?.data || err.message || 'Error deleting product.');
        } finally {
            setDeletingProductId(null);
        }
    };

    // --- Render Logic ---
    const cannotOperate = loadingDependencies || !!dependencyError; // Can't create/edit if deps failed or loading

    return (
        <div className="container mt-4">
            {/* --- Header and Create Button --- */}
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h2>Product Management</h2>
                <Button
                    variant="success"
                    onClick={handleOpenCreateModal}
                    title={dependencyError ? `Cannot create: ${dependencyError}` : (loadingDependencies ? 'Loading dependencies...' : 'Create New Product')}
                >
                    <i className="bi bi-plus-lg me-1"></i> Create Product
                    {loadingDependencies && <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="ms-1" />}
                </Button>
            </div>
            <ToastContainer position="top-right" autoClose={3000} />

            {/* --- Section Filter --- */}
            <Row className="mb-3">
                <Col md={4}>
                    <Form.Group controlId="sectionFilter">
                        <Form.Label>Filter by Section</Form.Label>
                        <Form.Select
                            aria-label="Filter products by section"
                            value={selectedSectionId}
                            onChange={handleSectionChange}
                            disabled={loadingDependencies || !!dependencyError || loadingProducts} // Disable while loading anything
                        >
                            <option value="all">All Sections</option>
                            {loadingDependencies && <option disabled>Loading sections...</option>}
                            {!loadingDependencies && sections.map(sec => (
                                <option key={sec.sectionId} value={sec.sectionId}>
                                    {sec.name || `Section ${sec.sectionId}`} {/* Display name or ID */}
                                </option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>

            {/* --- Loading / Error States --- */}
            {dependencyError && <Alert variant="warning">Could not load dependencies (Suppliers, Categories, or Sections): {dependencyError}. Some actions may be disabled.</Alert>}
            {loadingProducts && <div className="text-center my-3"><Spinner animation="border" /> Loading products {selectedSectionId !== 'all' ? `for selected section` : ''}...</div>}
            {productError && !loadingProducts && <Alert variant="danger">Error loading products: {productError}</Alert>}
            {!loadingProducts && !productError && products.length === 0 && <Alert variant="info">No products found {selectedSectionId !== 'all' ? `for the selected section` : ''}.</Alert>}

            {/* --- Product List --- */}
            <div className="table-responsive">
                <table className="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th>Photo</th>
                            <th>Name</th>
                            <th>Stock</th>
                            <th>Price</th>
                            <th>Expiry Date</th>
                            <th>Supplier</th>
                            <th>Category</th>
                            <th>Section</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!loadingProducts && !productError && products.map((product) => (
                            <tr key={product.productId}>
                                <td>
                                    {product.photo && (
                                        <img 
                                            src={`${API_BASE_URL.replace('/api', '')}${product.photo}`}
                                            alt={product.name} 
                                            style={{ maxHeight: '50px', objectFit: 'cover' }} 
                                        />
                                    )}
                                    {console.log(product.photo)}
                                </td>
                                <td>{product.name || 'N/A'}</td>
                                <td>{product.stock ?? 'N/A'}</td>
                                <td>${product.price?.toFixed(2) || 'N/A'}</td>
                                <td>{product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : 'N/A'}</td>
                                <td>{product.supplier?.name || product.supplierId?.substring(0, 8) + '...' || 'N/A'}</td>
                                <td>{product.category?.name || product.categoryId?.substring(0, 8) + '...' || 'N/A'}</td>
                                <td>
                                    {product.section?.name || (product.sectionId ? `ID: ${product.sectionId}` : 'N/A')}
                                </td>
                                <td>
                                    <div className="d-flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline-primary"
                                            onClick={() => handleOpenEditModal(product)}
                                            title={dependencyError ? `Cannot edit: ${dependencyError}` : (loadingDependencies ? 'Loading dependencies...' : 'Edit Product')}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline-danger"
                                            onClick={() => handleShowDeleteModal(product)}
                                            disabled={deletingProductId === product.productId}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- Delete Confirmation Modal --- */}
            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to delete the product named <strong>{productToDelete?.name}</strong>?</p>
                    <p className="text-danger">This action cannot be undone.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseDeleteModal}>
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleDeleteProduct}
                        disabled={deletingProductId === productToDelete?.productId}
                    >
                        {deletingProductId === productToDelete?.productId ?
                            <Spinner as="span" animation="border" size="sm" /> :
                            'Delete Product'
                        }
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* --- Create Product Modal --- */}
            <Modal show={showCreateModal} onHide={handleCloseCreateModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton><Modal.Title>Create New Product</Modal.Title></Modal.Header>
                {/* Use Form with ref */}
                <Form onSubmit={handleCreateSubmit} ref={createFormRef}>
                    <Modal.Body>
                        {/* No need to show loading spinner here as button is disabled */}
                        <Form.Group className="mb-3"><Form.Label>Name *</Form.Label><Form.Control type="text" name="name" value={newProduct.name} onChange={handleCreateInputChange} required autoFocus /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Stock *</Form.Label><Form.Control type="number" step="any" name="stock" value={newProduct.stock} onChange={handleCreateInputChange} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Expiry Date *</Form.Label><Form.Control type="date" name="expiryDate" value={newProduct.expiryDate} onChange={handleCreateInputChange} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Price *</Form.Label><Form.Control type="number" name="price" value={newProduct.price} onChange={handleCreateInputChange} required min="0" step="0.01" /></Form.Group>
                        {/* Photo Upload */}
                        <Form.Group controlId="formFile" className="mb-3"> <Form.Label>Product Photo (Optional)</Form.Label> <Form.Control type="file" name="photoFile" onChange={handlePhotoFileChange} accept="image/*" /> </Form.Group>
                        {/* Dependencies */}
                        <Form.Group className="mb-3"><Form.Label>Supplier *</Form.Label><Form.Select name="supplierId" value={newProduct.supplierId} onChange={handleCreateInputChange} required><option value="">Select Supplier</option>{suppliers.map(s => (<option key={s.supplierId} value={s.supplierId}>{s.name}</option>))}</Form.Select></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Category *</Form.Label><Form.Select name="categoryId" value={newProduct.categoryId} onChange={handleCreateInputChange} required><option value="">Select Category</option>{categories.map(c => (<option key={c.categoryId} value={c.categoryId}>{c.name}</option>))}</Form.Select></Form.Group>
                        {/* Section (Optional) */}
                        <Form.Group className="mb-3"><Form.Label>Section (Optional)</Form.Label><Form.Select name="sectionId" value={newProduct.sectionId} onChange={handleCreateInputChange}><option value="">No Section</option>{sections.map(sec => (<option key={sec.sectionId} value={sec.sectionId}>{sec.name || `Section ${sec.sectionId}`}</option>))}</Form.Select></Form.Group>
                        <small className="text-muted">* Required fields</small>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseCreateModal}>Cancel</Button>
                        <Button variant="primary" type="submit">Create</Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* --- Edit Product Modal --- */}
            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton><Modal.Title>Edit Product</Modal.Title></Modal.Header>
                {editingProduct && ( // Render form only when editingProduct is set
                    <Form onSubmit={handleUpdateSubmit}>
                        <Modal.Body>
                            {/* Display current photo if available */}
                            {editingProduct.photo && (
                                <div className="mb-3 text-center">
                                    <img src={`${API_BASE_URL.replace('/api', '')}${editingProduct.photo}`} alt="Current product" style={{ maxWidth: '150px', maxHeight: '150px', objectFit: 'contain' }} />
                                    <small className="d-block text-muted">Current Photo (Update does not change photo)</small>
                                </div>
                            )}
                            <Form.Group className="mb-3"><Form.Label>Name *</Form.Label><Form.Control type="text" name="name" value={editingProduct.name} onChange={handleEditInputChange} required autoFocus /></Form.Group>
                            <Form.Group className="mb-3"><Form.Label>Stock *</Form.Label><Form.Control type="number" step="any" name="stock" value={editingProduct.stock} onChange={handleEditInputChange} required /></Form.Group>
                            <Form.Group className="mb-3"><Form.Label>Expiry Date *</Form.Label><Form.Control type="date" name="expiryDate" value={editingProduct.expiryDate} onChange={handleEditInputChange} required /></Form.Group>
                            <Form.Group className="mb-3"><Form.Label>Price *</Form.Label><Form.Control type="number" name="price" value={editingProduct.price} onChange={handleEditInputChange} required min="0" step="0.01" /></Form.Group>
                            <Form.Group className="mb-3"><Form.Label>Supplier *</Form.Label><Form.Select name="supplierId" value={editingProduct.supplierId} onChange={handleEditInputChange} required><option value="">Select Supplier</option>{suppliers.map(s => (<option key={s.supplierId} value={s.supplierId}>{s.name}</option>))}</Form.Select></Form.Group>
                            <Form.Group className="mb-3"><Form.Label>Category *</Form.Label><Form.Select name="categoryId" value={editingProduct.categoryId} onChange={handleEditInputChange} required><option value="">Select Category</option>{categories.map(c => (<option key={c.categoryId} value={c.categoryId}>{c.name}</option>))}</Form.Select></Form.Group>
                            {/* Section (Optional) */}
                            <Form.Group className="mb-3"><Form.Label>Section (Optional)</Form.Label><Form.Select name="sectionId" value={editingProduct.sectionId} onChange={handleEditInputChange}><option value="">No Section</option>{sections.map(sec => (<option key={sec.sectionId} value={sec.sectionId}>{sec.name || `Section ${sec.sectionId}`}</option>))}</Form.Select></Form.Group>
                            <small className="text-muted">* Required fields</small>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={handleCloseEditModal}>Cancel</Button>
                            <Button variant="primary" type="submit">Update</Button>
                        </Modal.Footer>
                    </Form>
                )}
            </Modal>
        </div>
    );
}

export default ProductManagement;