// src/components/ProductList.js
// (Complete code with Fetch, Create, Edit, and Modal-based Delete)
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils'; // Adjust path if needed for your cookie helper
import { Table, Spinner, Alert, Image, Button, Modal, Form, Row, Col } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css'; // Ensure Bootstrap CSS is imported
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; // Ensure react-toastify CSS is imported
// Optional: Add icons if you have react-bootstrap-icons or similar
// import { PencilSquare, Trash, PlusLg } from 'react-bootstrap-icons';

// --- Configuration ---
const API_BASE_URL = 'https://localhost:7204/api'; // Your backend API base URL
const PHOTO_BASE_URL = 'https://localhost:7204'; // Base URL where product photos are served from

// --- Helper Functions ---

// Formats date for user-friendly display (e.g., MM/DD/YYYY based on locale)
const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A'; // Handle null or empty dates
    try {
        const date = new Date(dateString); // Attempt to parse the date string
        // Check if the parsed date is valid
        if (isNaN(date.getTime())) {
            console.warn("Invalid date string received for display:", dateString);
            return 'Invalid Date';
        }
        // Adjust for timezone offset to display the correct local date,
        // especially important if the date string is just YYYY-MM-DD
        const offset = date.getTimezoneOffset() * 60000; // Offset in milliseconds
        const localDate = new Date(date.getTime() + offset);
        return localDate.toLocaleDateString(); // Use browser's default locale format
    } catch (e) {
        console.error("Error formatting date for display:", dateString, e);
        return 'Invalid Date'; // Fallback on error
    }
};

// Formats date for the value of <input type="date"> (needs YYYY-MM-DD)
const formatDateForInput = (dateString) => {
    if (!dateString) return ''; // Return empty string for null or empty dates
    try {
        const date = new Date(dateString); // Attempt to parse the date string
        // Check if the parsed date is valid
        if (isNaN(date.getTime())) {
            console.warn("Invalid date string received for input:", dateString);
            // Handle cases where backend might send ISO string but it's invalid Date
            if (typeof dateString === 'string' && dateString.includes('T')) {
                return dateString.split('T')[0]; // Try taking the date part
            }
            return ''; // Return empty if unparsable
        }
        // Extract year, month, day (use UTC methods to avoid timezone shifts affecting the date parts)
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`; // Format as YYYY-MM-DD
    } catch (e) {
        console.error("Error formatting date for input:", dateString, e);
        // Fallback: If it's a string, try returning the first part before 'T'
        return typeof dateString === 'string' ? dateString.split('T')[0] : '';
    }
};


// --- Main Component ---
function ProductList() {
    // --- State Variables ---
    // Data States
    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [sections, setSections] = useState([]);

    // Loading States
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingDependencies, setLoadingDependencies] = useState(true);

    // Error States
    const [productError, setProductError] = useState(null);
    const [dependencyError, setDependencyError] = useState(null);

    // Create Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', stock: '', expiryDate: '', price: '', supplierId: '', categoryId: '', sectionId: '' });
    const [photoFile, setPhotoFile] = useState(null);
    const [isCreating, setIsCreating] = useState(false); // Loading state for Create API call
    const createFormRef = useRef(null); // Ref to reset create form

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null); // Stores the product being edited
    const [isUpdating, setIsUpdating] = useState(false); // Loading state for Update API call

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null); // Stores { id, name } of product targeted for delete
    const [isDeleting, setIsDeleting] = useState(false); // Loading state for Delete API call

    // Combined Loading/Error/Operation States for disabling UI elements
    const isLoading = loadingProducts || loadingDependencies; // True if any initial data is loading
    const overallError = productError || dependencyError; // Combined error message string
    const cannotOperate = loadingDependencies || !!dependencyError; // True if dependencies aren't ready or failed
    const isOperationRunning = isCreating || isUpdating || isDeleting; // True if any CUD API call is in progress

    // --- Authentication Helper ---
    const getAuthToken = useCallback(() => {
        const token = cookieUtils.getCookie('token'); // Get token from cookies
        return token;
    }, []); // No dependencies, safe to memoize

    // Generates Axios request configuration with Authorization header
    const getAuthConfig = useCallback((contentType = 'application/json') => {
        const token = getAuthToken(); // Get the current token
        if (!token) {
            console.error('Auth token is missing. User might need to log in.');
            toast.error('Authentication failed. Please log in again.'); // User feedback
            return null; // Indicate failure
        }
        const headers = {
            Authorization: `Bearer ${token}`, // Set bearer token
        };
        // Set Content-Type only if specified (needed for JSON PUT/POST)
        // For FormData (Create POST), let Axios set the correct multipart header
        if (contentType) {
            headers['Content-Type'] = contentType;
        }
        return { headers }; // Return config object
    }, [getAuthToken]); // Depends on getAuthToken


    // --- Data Fetching Function ---
    // Fetches products and all dependencies (suppliers, categories, sections)
    const fetchData = useCallback(async (isMounted) => {
        console.log("fetchData called. isMounted:", isMounted);
        // Prevent state updates if the component unmounted during the async operation
        if (!isMounted) {
            console.log("fetchData aborted: Component unmounted.");
            return;
        }

        // Set loading states and clear previous errors
        setLoadingProducts(true);
        setLoadingDependencies(true);
        setProductError(null);
        setDependencyError(null);

        // Check authentication status early
        const baseConfig = getAuthConfig();
        if (!baseConfig) {
             if (isMounted) { // Check mount status again before setting state
                 const authError = 'Authentication token not found. Please log in.';
                 setProductError(authError); setDependencyError(authError);
                 setLoadingProducts(false); setLoadingDependencies(false);
             }
             return; // Stop if not authenticated
         }

        // Perform API calls concurrently for efficiency
        try {
            console.log("Starting concurrent fetch for Products, Suppliers, Categories, Sections...");
            const [productsResponse, suppliersResponse, categoriesResponse, sectionsResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/Product`, baseConfig).catch(err => ({ error: true, data: err, type: 'Products' })),
                axios.get(`${API_BASE_URL}/Suppliers`, baseConfig).catch(err => ({ error: true, data: err, type: 'Suppliers' })),
                axios.get(`${API_BASE_URL}/Categories`, baseConfig).catch(err => ({ error: true, data: err, type: 'Categories' })),
                axios.get(`${API_BASE_URL}/Sections`, baseConfig).catch(err => ({ error: true, data: err, type: 'Sections' }))
            ]);

            // Check mount status AGAIN after awaits finish
            if (!isMounted) {
                console.log("fetchData aborted after awaits: Component unmounted.");
                return;
            }
            console.log("Fetch responses received.");

            let combinedError = null; // Accumulate error messages
            // Helper to process each API response
            const processResponse = (response, setData, setErrorState, entityName) => {
                const getErrorMessage = (err) => { // Standard error message extractor
                    return err.response?.data?.message || err.response?.data?.title || (typeof err.response?.data === 'string' && err.response.data) || err.message || `Failed to load ${entityName}.`;
                };

                if (response.error) { // Check if the axios call resulted in an error
                    const errorMsg = getErrorMessage(response.data);
                    console.error(`Error fetching ${entityName}:`, response.data.response?.status, errorMsg, response.data);
                    // Append the error message to the relevant error state
                    setErrorState((prev) => (prev ? `${prev}\n${entityName}: ${errorMsg}` : `${entityName}: ${errorMsg}`));
                    combinedError = (combinedError ? `${combinedError}\n${entityName}: ${errorMsg}` : `${entityName}: ${errorMsg}`);
                    setData([]); // Reset data for this entity on error
                    return false; // Indicate failure
                } else if (Array.isArray(response.data)) { // Check for successful response with array data
                    setData(response.data);
                    console.log(`${entityName} fetched successfully: ${response.data.length} items.`);
                    return true; // Indicate success
                } else { // Handle successful response but unexpected data format
                    const msg = `API returned unexpected data format for ${entityName}. Expected an array.`;
                    console.error(msg, "Received:", response.data);
                    setErrorState((prev) => (prev ? `${prev}\n${entityName}: ${msg}` : `${entityName}: ${msg}`));
                    combinedError = (combinedError ? `${combinedError}\n${entityName}: ${msg}` : `${entityName}: ${msg}`);
                    setData([]);
                    return false; // Indicate failure
                }
            };

            // Process results for each entity
            processResponse(productsResponse, setProducts, setProductError, 'Products');
            processResponse(suppliersResponse, setSuppliers, setDependencyError, 'Suppliers');
            processResponse(categoriesResponse, setCategories, setDependencyError, 'Categories');
            processResponse(sectionsResponse, setSections, setDependencyError, 'Sections');

            // Update loading states after processing all responses
            setLoadingProducts(false);
            setLoadingDependencies(false);

            if (combinedError) {
                // Show a general toast for errors; details are shown in the Alert component
                toast.error("Failed to load some required data. Please check details below.", { autoClose: 5000 });
            } else {
                console.log("All data fetching processes completed successfully.");
            }

        } catch (generalError) {
            // Catch errors not tied to specific axios requests (e.g., network error before Promise.all)
            if (isMounted) { // Check mount status before setting state
                console.error("A general network or setup error occurred during data fetching:", generalError);
                const errorMsg = "An unexpected error occurred while trying to fetch data.";
                setProductError(errorMsg); setDependencyError(errorMsg); // Set both errors
                setLoadingProducts(false); setLoadingDependencies(false); // Ensure loading state is off
                toast.error(errorMsg, { autoClose: 5000 });
            }
        }
    }, [getAuthConfig]); // Dependency: Recreate fetchData if getAuthConfig changes


    // --- Effect Hook for Initial Data Load ---
    // Runs once when the component mounts
    useEffect(() => {
        console.log("ProductList component mounted, running initial fetchData effect.");
        let isMounted = true; // Flag to track component mount status
        fetchData(isMounted); // Call the data fetching function

        // Cleanup function: Runs when the component unmounts
        return () => {
            console.log("ProductList component unmounting, setting isMounted flag to false.");
            isMounted = false; // Set flag to prevent state updates after unmount
        };
    }, [fetchData]); // Effect depends on the fetchData function reference


    // --- Memoized Lookup Maps ---
    // These maps avoid recalculating on every render unless the source data changes
    const supplierMap = useMemo(() => {
        // console.log("Recalculating supplierMap..."); // Uncomment for debugging map recreation
        return suppliers.reduce((map, supplier) => {
            if (supplier.supplierId) {
                map[supplier.supplierId] = supplier.name || `ID: ${supplier.supplierId.substring(0, 8)}...`; // Name or fallback ID
            }
            return map;
        }, {});
    }, [suppliers]); // Dependency: suppliers array

    const categoryMap = useMemo(() => {
        // console.log("Recalculating categoryMap..."); // Uncomment for debugging map recreation
        return categories.reduce((map, category) => {
            if (category.categoryId) {
                map[category.categoryId] = category.name || `ID: ${category.categoryId.substring(0, 8)}...`; // Name or fallback ID
            }
            return map;
        }, {});
    }, [categories]); // Dependency: categories array


    // --- Create Product Modal Handlers ---
    const handleOpenCreateModal = () => {
        console.log("Opening Create Modal");
        setNewProduct({ name: '', stock: '', expiryDate: '', price: '', supplierId: '', categoryId: '', sectionId: '' }); // Reset form state
        setPhotoFile(null); // Clear selected file
        if (createFormRef.current) { createFormRef.current.reset(); } // Reset native form (clears file input)
        setShowCreateModal(true); // Show modal
    };

    const handleCloseCreateModal = () => {
        console.log("Closing Create Modal");
        setShowCreateModal(false);
        setIsCreating(false); // Reset loading state
        // Clear state just in case it was closed manually
        setNewProduct({ name: '', stock: '', expiryDate: '', price: '', supplierId: '', categoryId: '', sectionId: '' });
        setPhotoFile(null);
    };

    const handleCreateInputChange = (e) => { // Updates newProduct state on form input change
        const { name, value } = e.target;
        setNewProduct(prev => ({ ...prev, [name]: value }));
    };

    const handlePhotoFileChange = (e) => { // Updates photoFile state when file input changes
        if (e.target.files && e.target.files.length > 0) {
            console.log("Photo file selected:", e.target.files[0].name);
            setPhotoFile(e.target.files[0]);
        } else {
            console.log("Photo file cleared.");
            setPhotoFile(null);
        }
    };

    // Handles the submission of the Create Product form
    const handleCreateSubmit = async (e) => {
        e.preventDefault(); // Prevent default browser form submission
        console.log("Attempting to create product:", newProduct);
        setIsCreating(true); // Show loading state

        const { name, stock, expiryDate, price, supplierId, categoryId, sectionId } = newProduct;

        // --- Frontend Validation ---
        if (!name.trim() || !stock.trim() || !expiryDate || !price.trim() || !supplierId || !categoryId) {
            toast.warn('Please fill in all required fields (*).'); setIsCreating(false); return;
        }
        const parsedPrice = parseFloat(price); if (isNaN(parsedPrice) || parsedPrice < 0) { toast.warn('Please enter a valid non-negative price.'); setIsCreating(false); return; }
        const parsedStock = parseFloat(stock); if (isNaN(parsedStock)) { toast.warn('Please enter a valid number for stock.'); setIsCreating(false); return; }
        let parsedSectionId = null; if (sectionId && sectionId !== '') { parsedSectionId = parseInt(sectionId, 10); if (isNaN(parsedSectionId)) { toast.warn('Invalid Section ID selected.'); setIsCreating(false); return; } }

        // --- Prepare FormData (for potential file upload) ---
        const formData = new FormData();
        formData.append('Name', name.trim()); formData.append('Stock', parsedStock); formData.append('ExpiryDate', expiryDate);
        formData.append('Price', parsedPrice); formData.append('SupplierId', supplierId); formData.append('CategoryId', categoryId);
        if (parsedSectionId !== null) { formData.append('SectionId', parsedSectionId); }
        if (photoFile) { formData.append('PhotoFile', photoFile); } // Append file if exists
        // console.log("FormData prepared:", Object.fromEntries(formData.entries())); // Log FormData (won't show file content)

        // --- Get Auth Config (No Content-Type needed for FormData) ---
        const config = getAuthConfig(null); if (!config) { setIsCreating(false); return; } // Auth failed

        // --- API Call (POST) ---
        try {
            const response = await axios.post(`${API_BASE_URL}/Product`, formData, config); // Send POST request
            console.log("Product creation successful:", response.data);
            toast.success(`Product "${response.data.name}" created successfully!`);
            handleCloseCreateModal(); // Close modal
            fetchData(true); // Refetch data to update the table
        } catch (err) { // Handle API errors
            console.error("Create Product Error:", err.response || err);
            const errorData = err.response?.data; let errorMessage = 'Error creating product.';
            if (typeof errorData === 'string') errorMessage = errorData;
            else if (errorData?.errors) errorMessage = Object.values(errorData.errors).flat().join(' ');
            else if (errorData?.title) errorMessage = errorData.title;
            else if (errorData?.message) errorMessage = errorData.message;
            else if (err.message) errorMessage = err.message;
            toast.error(`Creation failed: ${errorMessage}`);
        } finally {
            setIsCreating(false); // Reset loading state
        }
    };


    // --- Edit Product Modal Handlers ---
    const handleOpenEditModal = (product) => { // Opens the edit modal and pre-fills form state
        console.log("Opening Edit Modal for product ID:", product?.productId);
        if (!product) { console.error("Attempted to edit null product."); toast.error("Cannot edit: data missing."); return; }
        // Set the editing state with formatted data suitable for form inputs
        setEditingProduct({
            ...product, // Copy all product data
            expiryDate: formatDateForInput(product.expiryDate), // Format date for input
            price: product.price?.toString() ?? '', // Number to string
            stock: product.stock?.toString() ?? '', // Number to string
            supplierId: product.supplierId ?? '', // Handle null ID
            categoryId: product.categoryId ?? '', // Handle null ID
            sectionId: product.sectionId?.toString() ?? '', // Handle null or number ID
        });
        setShowEditModal(true); // Show the modal
    };

    const handleCloseEditModal = () => { // Closes the edit modal and resets state
        console.log("Closing Edit Modal");
        setShowEditModal(false);
        setEditingProduct(null); // Clear the product being edited
        setIsUpdating(false); // Reset loading state
    };

    const handleEditInputChange = (e) => { // Updates editingProduct state on form input change
        if (!editingProduct) return; // Should not happen, but safety first
        const { name, value } = e.target;
        setEditingProduct(prev => ({ ...prev, [name]: value }));
    };

    // Handles the submission of the Edit Product form
    const handleUpdateSubmit = async (e) => {
        e.preventDefault(); // Prevent default form submission
        if (!editingProduct || !editingProduct.productId) { toast.error("Cannot update: Product data invalid."); return; }
        console.log("Attempting to update product ID:", editingProduct.productId);
        setIsUpdating(true); // Show loading state

        const { productId, name, stock, expiryDate, price, photo, supplierId, categoryId, sectionId } = editingProduct;

        // --- Frontend Validation ---
        if (!name.trim() || !stock.trim() || !expiryDate || !price.trim() || !supplierId || !categoryId) { toast.warn('Please fill in all required fields (*).'); setIsUpdating(false); return; }
        const parsedPrice = parseFloat(price); if (isNaN(parsedPrice) || parsedPrice < 0) { toast.warn('Invalid price.'); setIsUpdating(false); return; }
        const parsedStock = parseFloat(stock); if (isNaN(parsedStock)) { toast.warn('Invalid stock.'); setIsUpdating(false); return; }
        let parsedSectionId = null; if (sectionId && sectionId !== '') { parsedSectionId = parseInt(sectionId, 10); if (isNaN(parsedSectionId)) { toast.warn('Invalid Section ID.'); setIsUpdating(false); return; } }

        // --- Prepare Payload (JSON, NO nested objects) ---
        const updatedProductData = {
            productId, name: name.trim(), stock: parsedStock, expiryDate, // Send YYYY-MM-DD
            price: parsedPrice, photo, // Send existing photo path string
            supplierId, categoryId, sectionId: parsedSectionId
        };

        // --- Get Auth Config (Specify JSON Content-Type) ---
        const config = getAuthConfig('application/json'); if (!config) { setIsUpdating(false); return; } // Auth failed

        console.log(`Submitting PUT to: ${API_BASE_URL}/Product/${productId}`);
        console.log("Payload being sent:", JSON.stringify(updatedProductData, null, 2)); // Log the exact payload

        // --- API Call (PUT) ---
        try {
            await axios.put(`${API_BASE_URL}/Product/${productId}`, updatedProductData, config); // Send PUT request
            console.log("Product update successful for ID:", productId);
            toast.success(`Product "${updatedProductData.name}" updated successfully!`);

            // --- Update UI (Optimistic) ---
             setProducts(prevProducts =>
                prevProducts.map(p =>
                    p.productId === productId
                        ? { ...p, ...updatedProductData, expiryDate: new Date(updatedProductData.expiryDate + 'T00:00:00Z') } // Merge updates
                        : p // Keep other products
                )
            );
            console.log("Optimistic UI update applied.");
            handleCloseEditModal(); // Close modal on success

        } catch (err) { // Handle API errors
            console.error("Update Product Error:", err.response || err);
            const errorData = err.response?.data; let errorMessage = 'Error updating product.';
            if (err.response?.status === 400) { if (typeof errorData === 'string') errorMessage = `Validation Error: ${errorData}`; else if (errorData?.errors) errorMessage = `Validation Errors: ${Object.entries(errorData.errors).map(([field, msgs]) => `${field}: ${msgs.join(', ')}`).join('; ')}`; else if (errorData?.title) errorMessage = `Validation Error: ${errorData.title}`; else errorMessage = 'Bad Request: Invalid data.'; }
            else if (err.response?.status === 404) errorMessage = 'Product not found.';
            else if (typeof errorData === 'string' && errorData) errorMessage = errorData;
            else if (errorData?.message) errorMessage = errorData.message;
            else if (err.message) errorMessage = err.message;
            toast.error(`Update failed: ${errorMessage}`);
            // Keep modal open on error? Current behavior closes it via finally.
        } finally {
            setIsUpdating(false); // Reset loading state
        }
    };


    // --- Delete Product Modal Handlers ---
    const handleOpenDeleteModal = (productId, productName) => { // Opens the delete confirmation modal
        console.log(`Opening Delete Modal for product: ID=${productId}, Name=${productName}`);
        if (!productId) { console.error("Delete failed: Product ID missing."); toast.error("Cannot delete: ID missing."); return; }
        setProductToDelete({ id: productId, name: productName || `ID: ${productId}` }); // Store target info
        setShowDeleteModal(true); // Show the modal
    };

    const handleCloseDeleteModal = () => { // Closes the delete modal and resets state
        console.log("Closing Delete Modal");
        setShowDeleteModal(false);
        setProductToDelete(null); // Clear target product info
        setIsDeleting(false); // Reset deleting loading state
    };

    // Handles the actual deletion after user confirms in the modal
    const handleConfirmDelete = async () => {
        if (!productToDelete || !productToDelete.id) { // Safety check
            toast.error("Deletion failed: Target product info missing.");
            handleCloseDeleteModal(); return;
        }

        const { id: productId, name: productName } = productToDelete; // Get ID and name
        console.log(`Confirmed delete for product: ID=${productId}, Name=${productName}`);
        setIsDeleting(true); // Set loading state for API call

        // --- Get Auth Config ---
        const config = getAuthConfig(); // No specific Content-Type needed for DELETE
        if (!config) { setIsDeleting(false); return; } // Auth failed

        console.log(`Proceeding with DELETE request for ID: ${productId}`);

        // --- API Call (DELETE) ---
        try {
            await axios.delete(`${API_BASE_URL}/Product/${productId}`, config); // Send DELETE request
            console.log("Product deletion successful via API for ID:", productId);
            toast.success(`Product "${productName}" deleted successfully!`);

            // --- Update UI ---
            setProducts(prevProducts => prevProducts.filter(p => p.productId !== productId)); // Remove from local list
            handleCloseDeleteModal(); // Close modal on success

        } catch (err) { // Handle API errors
            console.error("Delete Product Error:", err.response || err);
            const errorData = err.response?.data; let errorMessage = 'Error deleting product.';
             if (err.response?.status === 404) { errorMessage = 'Product not found. Maybe already deleted?'; setProducts(prevProducts => prevProducts.filter(p => p.productId !== productId)); } // Remove locally if 404
            else if (typeof errorData === 'string' && errorData) errorMessage = errorData;
            else if (errorData?.message) errorMessage = errorData.message;
            else if (err.message) errorMessage = err.message;
            toast.error(`Deletion failed: ${errorMessage}`);
            handleCloseDeleteModal(); // Close modal even on error
        }
        // 'finally' block to reset isDeleting is handled by handleCloseDeleteModal
    };


    // --- JSX Rendering ---
    return (
        <div className="container mt-4">
            {/* Page Header and Create Button */}
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h2>All Products</h2>
                <Button
                    variant="success"
                    onClick={handleOpenCreateModal}
                    disabled={cannotOperate || isOperationRunning} // Disable if dependencies loading/error OR any op running
                    title={cannotOperate ? `Cannot create: ${dependencyError || 'Loading dependencies...'}` : 'Create New Product'}
                >
                    Create Product
                    {/* Show spinner only if dependencies are loading (and no error) */}
                    {loadingDependencies && !dependencyError && <Spinner as="span" animation="border" size="sm" className="ms-1" />}
                </Button>
            </div>

            {/* Toast Notifications Container */}
            <ToastContainer position="top-right" autoClose={4000} hideProgressBar={false} newestOnTop theme="colored" />

            {/* Loading State Indicator */}
            {isLoading && (
                <div className="text-center my-5">
                    <Spinner animation="border" role="status" variant="primary">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                    <p className="mt-2 text-muted">Loading data...</p>
                </div>
            )}

            {/* Error Display Area */}
            {overallError && !isLoading && (
                <Alert variant="danger" className="mt-3">
                    <Alert.Heading>Error Loading Data</Alert.Heading>
                    {/* Display each error message on a new line */}
                    {overallError.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)}
                    <hr />
                    <Button variant="outline-danger" size="sm" onClick={() => fetchData(true)} disabled={isLoading}>Retry Fetch</Button>
                </Alert>
            )}

            {/* Product Table (Render only if not loading and no errors) */}
            {!isLoading && !overallError && (
                 products.length > 0 ? ( // If products array has items
                    <div className="table-responsive mt-3">
                        <Table striped bordered hover responsive="sm">
                            {/* Table Header */}
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
                                    <th style={{ minWidth: '180px', textAlign: 'center' }}>Actions</th> {/* Adjusted width */}
                                </tr>
                            </thead>
                            {/* Table Body */}
                            <tbody>
                                {products.map((product) => (
                                    <tr key={product.productId}>
                                        {/* Data Cells */}
                                        <td style={{ width: '80px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {product.photo ? (
                                                <Image src={`${PHOTO_BASE_URL}${product.photo}`} alt={product.name || 'Product'} thumbnail style={{ maxHeight: '60px', maxWidth: '60px', objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} loading="lazy" />
                                             ) : ( <span className="text-muted small">No Photo</span> )}
                                        </td>
                                        <td style={{ verticalAlign: 'middle' }}>{product.name || 'N/A'}</td>
                                        <td style={{ verticalAlign: 'middle' }}>{product.stock ?? 'N/A'}</td>
                                        <td style={{ verticalAlign: 'middle' }}>{(typeof product.price === 'number') ? `$${product.price.toFixed(2)}` : 'N/A'}</td>
                                        <td style={{ verticalAlign: 'middle' }}>{formatDateForDisplay(product.expiryDate)}</td>
                                        <td style={{ verticalAlign: 'middle' }}>{supplierMap[product.supplierId] || <small title={product.supplierId}>ID: {product.supplierId?.substring(0, 8)}...</small>}</td>
                                        <td style={{ verticalAlign: 'middle' }}>{categoryMap[product.categoryId] || <small title={product.categoryId}>ID: {product.categoryId?.substring(0, 8)}...</small>}</td>
                                        <td style={{ verticalAlign: 'middle' }}>
                                            {/* Display Section info concisely */}
                                            {product.section ? `${product.section.name || 'Unnamed'} (SH:${product.section.storehouses.storehouseName || 'N/A'})` : product.sectionId ? `ID: ${product.sectionId}` : 'N/A'}
                                        </td>
                                        {/* Actions Cell */}
                                        <td style={{ verticalAlign: 'middle' }}>
                                            <div className="d-flex gap-2 justify-content-center flex-wrap">
                                                {/* Edit Button */}
                                                <Button size="sm" variant="outline-primary" onClick={() => handleOpenEditModal(product)} disabled={cannotOperate || isOperationRunning} title={cannotOperate ? `Cannot edit: ${dependencyError || 'Loading...'}` : 'Edit Product'}>
                                                    Edit
                                                </Button>
                                                {/* Delete Button (Opens Modal) */}
                                                <Button size="sm" variant="outline-danger" onClick={() => handleOpenDeleteModal(product.productId, product.name)} disabled={cannotOperate || isOperationRunning} title={cannotOperate ? `Cannot delete: ${dependencyError || 'Loading...'}` : 'Delete Product'}>
                                                    Delete
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                ) : ( // If no products found (and no error occurred fetching them)
                    !productError && products.length === 0 ? (
                         <Alert variant="info" className="mt-3 text-center">No products found. Add one using the 'Create Product' button.</Alert>
                    ) : null // Otherwise, the error alert handles the display
                )
            )}

            {/* --- Modals --- */}

            {/* Create Product Modal */}
             <Modal show={showCreateModal} onHide={handleCloseCreateModal} backdrop="static" keyboard={false} centered size="lg">
                <Modal.Header closeButton><Modal.Title>Create New Product</Modal.Title></Modal.Header>
                <Form onSubmit={handleCreateSubmit} ref={createFormRef}>
                    <Modal.Body>
                        {/* Required Fields */}
                        <Form.Group className="mb-3" controlId="createProductName"><Form.Label>Name *</Form.Label><Form.Control type="text" name="name" value={newProduct.name} onChange={handleCreateInputChange} required autoFocus /></Form.Group>
                        <Row><Col md={6}><Form.Group className="mb-3" controlId="createProductStock"><Form.Label>Stock *</Form.Label><Form.Control type="number" step="any" name="stock" value={newProduct.stock} onChange={handleCreateInputChange} required placeholder="e.g., 10 or 5.5" /></Form.Group></Col><Col md={6}><Form.Group className="mb-3" controlId="createProductPrice"><Form.Label>Price *</Form.Label><Form.Control type="number" name="price" value={newProduct.price} onChange={handleCreateInputChange} required min="0" step="0.01" placeholder="e.g., 19.99"/></Form.Group></Col></Row>
                        <Form.Group className="mb-3" controlId="createProductExpiryDate"><Form.Label>Expiry Date *</Form.Label><Form.Control type="date" name="expiryDate" value={newProduct.expiryDate} onChange={handleCreateInputChange} required /></Form.Group>
                        <Form.Group className="mb-3" controlId="createProductSupplier"><Form.Label>Supplier *</Form.Label><Form.Select name="supplierId" value={newProduct.supplierId} onChange={handleCreateInputChange} required aria-label="Select Supplier"><option value="">Select Supplier...</option>{suppliers.map(s => (<option key={s.supplierId} value={s.supplierId}>{s.name || `ID: ${s.supplierId}`}</option>))}</Form.Select></Form.Group>
                        <Form.Group className="mb-3" controlId="createProductCategory"><Form.Label>Category *</Form.Label><Form.Select name="categoryId" value={newProduct.categoryId} onChange={handleCreateInputChange} required aria-label="Select Category"><option value="">Select Category...</option>{categories.map(c => (<option key={c.categoryId} value={c.categoryId}>{c.name || `ID: ${c.categoryId}`}</option>))}</Form.Select></Form.Group>
                        {/* Optional Fields */}
                        <Form.Group controlId="createProductPhoto" className="mb-3"><Form.Label>Product Photo (Optional)</Form.Label><Form.Control type="file" name="photoFile" onChange={handlePhotoFileChange} accept="image/*" /></Form.Group>
                        <Form.Group className="mb-3" controlId="createProductSection"><Form.Label>Section (Optional)</Form.Label><Form.Select name="sectionId" value={newProduct.sectionId} onChange={handleCreateInputChange} aria-label="Select Section"><option value="">No Section</option>{sections.map(sec => (<option key={sec.sectionId} value={sec.sectionId}>{sec.name || `Sec ID: ${sec.sectionId}`} - (SH: {sec.storehousesId || 'N/A'})</option>))}</Form.Select></Form.Group>
                        <small className="text-muted">* Required fields</small>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseCreateModal} disabled={isCreating}>Cancel</Button>
                        <Button variant="primary" type="submit" disabled={isCreating}>{isCreating ? <><Spinner size="sm" className="me-1" />Creating...</> : 'Create Product'}</Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            {/* Edit Product Modal */}
            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" keyboard={false} centered size="lg">
                <Modal.Header closeButton><Modal.Title>Edit Product {editingProduct ? `- ${editingProduct.name}` : ''}</Modal.Title></Modal.Header>
                {editingProduct && (
                    <Form onSubmit={handleUpdateSubmit}>
                        <Modal.Body>
                            {/* Display current photo */}
                            {editingProduct.photo && (<div className="mb-3 text-center"><Image src={`${PHOTO_BASE_URL}${editingProduct.photo}`} alt="Current product" style={{ maxWidth: '150px', maxHeight: '150px', objectFit: 'contain' }} thumbnail onError={(e) => { e.currentTarget.style.display = 'none'; }}/><small className="d-block text-muted mt-1">Current Photo (Cannot be changed here)</small></div>)}
                            {/* Form fields pre-filled */}
                            <Form.Group className="mb-3" controlId="editProductName"><Form.Label>Name *</Form.Label><Form.Control type="text" name="name" value={editingProduct.name} onChange={handleEditInputChange} required autoFocus /></Form.Group>
                            <Row><Col md={6}><Form.Group className="mb-3" controlId="editProductStock"><Form.Label>Stock *</Form.Label><Form.Control type="number" step="any" name="stock" value={editingProduct.stock} onChange={handleEditInputChange} required /></Form.Group></Col><Col md={6}><Form.Group className="mb-3" controlId="editProductPrice"><Form.Label>Price *</Form.Label><Form.Control type="number" name="price" value={editingProduct.price} onChange={handleEditInputChange} required min="0" step="0.01" /></Form.Group></Col></Row>
                            <Form.Group className="mb-3" controlId="editProductExpiryDate"><Form.Label>Expiry Date *</Form.Label><Form.Control type="date" name="expiryDate" value={editingProduct.expiryDate} onChange={handleEditInputChange} required /></Form.Group>
                            <Form.Group className="mb-3" controlId="editProductSupplier"><Form.Label>Supplier *</Form.Label><Form.Select name="supplierId" value={editingProduct.supplierId} onChange={handleEditInputChange} required aria-label="Select Supplier"><option value="">Select Supplier...</option>{suppliers.map(s => (<option key={s.supplierId} value={s.supplierId}>{s.name || `ID: ${s.supplierId}`}</option>))}</Form.Select></Form.Group>
                            <Form.Group className="mb-3" controlId="editProductCategory"><Form.Label>Category *</Form.Label><Form.Select name="categoryId" value={editingProduct.categoryId} onChange={handleEditInputChange} required aria-label="Select Category"><option value="">Select Category...</option>{categories.map(c => (<option key={c.categoryId} value={c.categoryId}>{c.name || `ID: ${c.categoryId}`}</option>))}</Form.Select></Form.Group>
                            <Form.Group className="mb-3" controlId="editProductSection"><Form.Label>Section (Optional)</Form.Label><Form.Select name="sectionId" value={editingProduct.sectionId} onChange={handleEditInputChange} aria-label="Select Section"><option value="">No Section</option>{sections.map(sec => (<option key={sec.sectionId} value={sec.sectionId}>{sec.name || `Sec ID: ${sec.sectionId}`} - (SH: {sec.storehousesId || 'N/A'})</option>))}</Form.Select></Form.Group>
                            <small className="text-muted">* Required fields</small>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={handleCloseEditModal} disabled={isUpdating}>Cancel</Button>
                            <Button variant="primary" type="submit" disabled={isUpdating}>{isUpdating ? <><Spinner size="sm" className="me-1" />Updating...</> : 'Save Changes'}</Button>
                        </Modal.Footer>
                    </Form>
                 )}
                 {/* Fallback spinner if modal shows briefly before editingProduct is set */}
                 {!editingProduct && showEditModal && (<Modal.Body><div className="text-center"><Spinner animation="border" variant="primary" /></div></Modal.Body>)}
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} centered backdrop="static" keyboard={false}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to delete the product: <br />
                    <strong>{productToDelete?.name || 'this item'}</strong>?
                    <p className="text-danger mt-2 mb-0"><small>This action cannot be undone.</small></p>
                </Modal.Body>
                <Modal.Footer>
                    {/* Cancel Button */}
                    <Button variant="secondary" onClick={handleCloseDeleteModal} disabled={isDeleting}>
                        Cancel
                    </Button>
                    {/* Confirm Delete Button */}
                    <Button variant="danger" onClick={handleConfirmDelete} disabled={isDeleting}>
                        {isDeleting ? (
                            <><Spinner as="span" animation="border" size="sm" className="me-1" />Deleting...</>
                        ) : (
                            'Confirm Delete'
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

        </div> // End of main container div
    );
}

export default ProductList; // Export the component