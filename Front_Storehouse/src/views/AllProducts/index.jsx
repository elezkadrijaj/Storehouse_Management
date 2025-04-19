import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { Table, Spinner, Alert, Image, Button, Modal, Form, Row, Col } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import cookieUtils from '../auth/cookieUtils';

const API_BASE_URL = 'https://localhost:7204/api';
const PHOTO_BASE_URL = 'https://localhost:7204';

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            console.warn("Invalid date string for display:", dateString);
            return 'Invalid Date';
        }
        const year = date.getUTCFullYear();
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = date.getUTCDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Error formatting date for display:", dateString, e);
        return 'Invalid Date';
    }
};

const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            console.warn("Invalid date string for input:", dateString);
             if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
                return dateString.split('T')[0];
             }
             return '';
        }
        const year = date.getUTCFullYear();
        const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const day = date.getUTCDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Error formatting date for input:", dateString, e);
        return typeof dateString === 'string' ? dateString.split('T')[0] : '';
    }
};

function ProductList() {
    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [sections, setSections] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingDependencies, setLoadingDependencies] = useState(true);
    const [productError, setProductError] = useState(null);
    const [dependencyError, setDependencyError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', stock: '', expiryDate: '', price: '', supplierId: '', categoryId: '', sectionId: '' });
    const [photoFile, setPhotoFile] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const createFormRef = useRef(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const getAuthToken = useCallback(() => sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN), []);
    const getCompanyId = useCallback(() => cookieUtils.getCompanyIdFromCookies(), []);

    const getAuthConfig = useCallback((contentType = 'application/json') => {
        const token = getAuthToken();
        if (!token) {
            console.error('Auth token is missing from cookies.');
            toast.error('Authentication failed. Please log in again.');
            return null;
        }
        const headers = { Authorization: `Bearer ${token}` };
        if (contentType) {
            headers['Content-Type'] = contentType;
        }
        return { headers };
    }, [getAuthToken]);

    const fetchData = useCallback(async (isMounted) => {
        console.log("fetchData called. isMounted:", isMounted);
        if (!isMounted) { console.log("fetchData aborted: Component unmounted."); return; }

        setLoadingProducts(true); setLoadingDependencies(true);
        setProductError(null); setDependencyError(null);

        const token = getAuthToken();
        const companyIdFromCookie = getCompanyId();

        if (!token) {
            const authError = 'Authentication token not found in cookies. Please log in.';
            if (isMounted) { setProductError(authError); setDependencyError(authError); setLoadingProducts(false); setLoadingDependencies(false); }
            return;
        }
        if (!companyIdFromCookie) {
            const companyError = 'Company ID not found in cookies. Cannot fetch products.';
            console.error(companyError);
            if (isMounted) { setProductError(companyError); setDependencyError(companyError); setLoadingProducts(false); setLoadingDependencies(false); }
            toast.error(companyError, { autoClose: false });
            return;
        }
        console.log(`Proceeding to fetch data (Company ID ${companyIdFromCookie} expected in token).`);

        const config = getAuthConfig();
        if (!config) {
             if (isMounted) { setLoadingProducts(false); setLoadingDependencies(false); }
             return;
        }
        const baseHeaders = config.headers;

        try {
            console.log("Starting concurrent fetch for Products (using token claim), Suppliers, Categories, Sections...");
            const [productsResponse, suppliersResponse, categoriesResponse, sectionsResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/Product`, {
                    headers: baseHeaders
                }).catch(err => ({ error: true, data: err, type: 'Products' })),
                axios.get(`${API_BASE_URL}/Suppliers`, { headers: baseHeaders }).catch(err => ({ error: true, data: err, type: 'Suppliers' })),
                axios.get(`${API_BASE_URL}/Categories`, { headers: baseHeaders }).catch(err => ({ error: true, data: err, type: 'Categories' })),
                axios.get(`${API_BASE_URL}/Sections`, { headers: baseHeaders }).catch(err => ({ error: true, data: err, type: 'Sections' }))
            ]);

            if (!isMounted) { console.log("fetchData aborted after awaits: Component unmounted."); return; }
            console.log("Fetch responses received.");

            let combinedError = null;
            const getErrorMessage = (err, entityName) => err.response?.data || (typeof err.response?.data === 'string' && err.response.data) || err.message || `Failed to load ${entityName}.`;

            if (productsResponse.error) {
                const errorMsg = getErrorMessage(productsResponse.data, 'Products');
                console.error(`Error fetching Products:`, productsResponse.data.response?.status, errorMsg, productsResponse.data);
                 if (productsResponse.data.response?.status === 401 || productsResponse.data.response?.status === 403) {
                     setProductError(`Products: Unauthorized or Forbidden. ${errorMsg}`);
                     toast.error(`Failed to load products: ${errorMsg}`);
                 } else {
                     setProductError(`Products: ${errorMsg}`);
                 }
                combinedError = `Products: ${errorMsg}`; setProducts([]);
            } else if (Array.isArray(productsResponse.data)) {
                setProducts(productsResponse.data); console.log(`Products fetched successfully: ${productsResponse.data.length} items (company inferred from token).`);
            } else {
                const msg = `Products: API returned unexpected data format. Expected an array.`; console.error(msg, "Received:", productsResponse.data);
                setProductError(msg); combinedError = msg; setProducts([]);
            }
            setLoadingProducts(false);

            let depErrorMsg = '';
            const processDep = (resp, setData, name) => {
                 if (resp.error) { const msg = getErrorMessage(resp.data, name); console.error(`Error fetching ${name}:`, resp.data.response?.status, msg, resp.data); depErrorMsg += `${name}: ${msg}\n`; setData([]); return false; }
                 else if (Array.isArray(resp.data)) { setData(resp.data); console.log(`${name} fetched successfully: ${resp.data.length} items.`); return true; }
                 else { const msg = `${name}: Unexpected data format.`; console.error(msg, "Received:", resp.data); depErrorMsg += `${msg}\n`; setData([]); return false; }
             };
            processDep(suppliersResponse, setSuppliers, 'Suppliers');
            processDep(categoriesResponse, setCategories, 'Categories');
            processDep(sectionsResponse, setSections, 'Sections');

            if (depErrorMsg) { setDependencyError(depErrorMsg.trim()); combinedError = combinedError ? `${combinedError}\n${depErrorMsg.trim()}` : depErrorMsg.trim(); }
            setLoadingDependencies(false);

            if (combinedError) {
                if (!toast.isActive('data-load-error') && !(productError && (productError.includes('Unauthorized') || productError.includes('Forbidden')))) {
                    toast.error("Failed to load some required data. See details.", { autoClose: 5000, toastId: 'data-load-error' });
                }
            } else {
                console.log("All data fetching processes completed successfully.");
            }

        } catch (generalError) {
             if (isMounted) {
                console.error("General network/setup error during data fetching:", generalError);
                const errorMsg = "An unexpected network or setup error occurred.";
                setProductError(errorMsg); setDependencyError(errorMsg);
                setLoadingProducts(false); setLoadingDependencies(false);
                toast.error(errorMsg, { autoClose: 5000 });
            }
        }
    }, [getAuthConfig, getAuthToken, getCompanyId]);

    useEffect(() => {
        console.log("ProductList component mounted, running initial fetchData effect.");
        let isMounted = true;
        fetchData(isMounted);
        return () => {
            console.log("ProductList component unmounting, setting isMounted flag to false.");
            isMounted = false;
        };
    }, [fetchData]);

    const supplierMap = useMemo(() => suppliers.reduce((map, s) => { if(s.supplierId) map[s.supplierId] = s.name || `ID: ${s.supplierId.substring(0, 8)}...`; return map; }, {}), [suppliers]);
    const categoryMap = useMemo(() => categories.reduce((map, c) => { if(c.categoryId) map[c.categoryId] = c.name || `ID: ${c.categoryId.substring(0, 8)}...`; return map; }, {}), [categories]);

    const handleOpenCreateModal = () => {
        console.log("handleOpenCreateModal called");
        setNewProduct({ name: '', stock: '', expiryDate: '', price: '', supplierId: '', categoryId: '', sectionId: '' });
        setPhotoFile(null);
        if (createFormRef.current) { createFormRef.current.reset(); }
        setShowCreateModal(true);
        console.log("setShowCreateModal(true) executed");
    };
    const handleCloseCreateModal = () => {
        console.log("Closing Create Modal");
        setShowCreateModal(false);
        setIsCreating(false);
        setNewProduct({ name: '', stock: '', expiryDate: '', price: '', supplierId: '', categoryId: '', sectionId: '' });
        setPhotoFile(null);
    };
    const handleCreateInputChange = (e) => {
        const { name, value } = e.target;
        setNewProduct(prev => ({ ...prev, [name]: value }));
    };
    const handlePhotoFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            console.log("Photo file selected:", e.target.files[0].name);
            setPhotoFile(e.target.files[0]);
        } else {
            console.log("Photo file cleared.");
            setPhotoFile(null);
        }
    };
    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        console.log("Attempting to create product:", newProduct);
        setIsCreating(true);

        const { name, stock, expiryDate, price, supplierId, categoryId, sectionId } = newProduct;

        if (!name.trim() || !stock || !expiryDate || !price || !supplierId || !categoryId) { toast.warn('Please fill in all required fields (*).'); setIsCreating(false); return; }
        const parsedPrice = parseFloat(price); if (isNaN(parsedPrice) || parsedPrice < 0) { toast.warn('Please enter a valid non-negative price.'); setIsCreating(false); return; }
        const parsedStock = parseFloat(stock); if (isNaN(parsedStock)) { toast.warn('Please enter a valid number for stock.'); setIsCreating(false); return; }
        let parsedSectionId = null; if (sectionId && sectionId !== '') { parsedSectionId = parseInt(sectionId, 10); if (isNaN(parsedSectionId)) { toast.warn('Invalid Section ID selected.'); setIsCreating(false); return; } }

        const formData = new FormData();
        formData.append('Name', name.trim());
        formData.append('Stock', parsedStock);
        formData.append('ExpiryDate', expiryDate);
        formData.append('Price', parsedPrice);
        formData.append('SupplierId', supplierId);
        formData.append('CategoryId', categoryId);
        if (parsedSectionId !== null) { formData.append('SectionId', parsedSectionId); }
        if (photoFile) { formData.append('PhotoFile', photoFile, photoFile.name); }

        const config = getAuthConfig(null);
        if (!config) { setIsCreating(false); return; }

        try {
            const response = await axios.post(`${API_BASE_URL}/Product`, formData, config);
            console.log("Product creation successful:", response.data);
            toast.success(`Product "${response.data.name}" created successfully!`);
            handleCloseCreateModal();
            fetchData(true);
        } catch (err) {
            console.error("Create Product Error:", err.response || err);
            const errorData = err.response?.data; let errorMessage = 'Error creating product.';
            if (err.response?.status === 400 && errorData?.errors) { errorMessage = `Validation Errors: ${Object.entries(errorData.errors).map(([field, msgs]) => `${field}: ${msgs.join(', ')}`).join('; ')}`; }
            else if (err.response?.status === 409) { errorMessage = errorData || 'Conflict: Product might already exist.'; }
            else if (typeof errorData === 'string') errorMessage = errorData;
            else if (errorData?.title) errorMessage = errorData.title;
            else if (errorData?.message) errorMessage = errorData.message;
            else if (err.message) errorMessage = err.message;
            toast.error(`Creation failed: ${errorMessage}`);
        } finally {
            setIsCreating(false);
        }
    };

    const handleOpenEditModal = (product) => {
        console.log("handleOpenEditModal called for product:", product?.productId);
         if (!product) { console.error("Attempted to edit null product."); toast.error("Cannot edit: data missing."); return; }
         const productToEdit = {
            ...product,
            expiryDate: formatDateForInput(product.expiryDate),
            price: product.price != null ? product.price.toString() : '',
            stock: product.stock != null ? product.stock.toString() : '',
            supplierId: product.supplierId || '',
            categoryId: product.categoryId || '',
            sectionId: product.sectionId != null ? product.sectionId.toString() : '',
         };
         console.log("Setting editingProduct state:", productToEdit);
         setEditingProduct(productToEdit);
         setShowEditModal(true);
         console.log("setShowEditModal(true) executed");
    };
    const handleCloseEditModal = () => {
        console.log("Closing Edit Modal");
        setShowEditModal(false);
        setEditingProduct(null);
        setIsUpdating(false);
    };
    const handleEditInputChange = (e) => {
        if (!editingProduct) return;
        const { name, value } = e.target;
        console.log(`Edit Input Change - Name: ${name}, Value: ${value}`);
        setEditingProduct(prev => {
            const newState = { ...prev, [name]: value };
            console.log('Intended new editingProduct state:', newState);
            return newState;
        });
    };
    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        if (!editingProduct || !editingProduct.productId) { toast.error("Cannot update: Product data invalid."); return; }
        console.log("Attempting to update product ID:", editingProduct.productId);
        setIsUpdating(true);

        const { productId, name, stock, expiryDate, price, photo,
                supplierId, categoryId, sectionId } = editingProduct;

        if (!name.trim() || !stock || !expiryDate || !price || !supplierId || !categoryId) { toast.warn('Please fill in all required fields (*).'); setIsUpdating(false); return; }
        const parsedPrice = parseFloat(price); if (isNaN(parsedPrice) || parsedPrice < 0) { toast.warn('Invalid price.'); setIsUpdating(false); return; }
        const parsedStock = parseFloat(stock); if (isNaN(parsedStock)) { toast.warn('Invalid stock.'); setIsUpdating(false); return; }
        let parsedSectionId = null; if (sectionId && sectionId !== '') { parsedSectionId = parseInt(sectionId, 10); if (isNaN(parsedSectionId)) { toast.warn('Invalid Section ID.'); setIsUpdating(false); return; } }

        const updatedProductData = {
            productId: productId,
            name: name.trim(),
            stock: parsedStock,
            expiryDate: expiryDate,
            price: parsedPrice,
            photo: photo,
            supplierId: supplierId,
            categoryId: categoryId,
            sectionId: parsedSectionId
        };

        const config = getAuthConfig('application/json');
        if (!config) { setIsUpdating(false); return; }

        console.log(`Submitting PUT to: ${API_BASE_URL}/Product/${productId}`);
        console.log("Payload being sent:", JSON.stringify(updatedProductData, null, 2));

        try {
            await axios.put(`${API_BASE_URL}/Product/${productId}`, updatedProductData, config);
            console.log("Product update successful for ID:", productId);
            toast.success(`Product "${updatedProductData.name}" updated successfully!`);

            const updatedProductForState = {
                ...editingProduct,
                ...updatedProductData,
                 expiryDate: new Date(updatedProductData.expiryDate + 'T00:00:00Z'),
            };
             setProducts(prevProducts =>
                prevProducts.map(p => p.productId === productId ? { ...p, ...updatedProductForState } : p)
             );
            handleCloseEditModal();

        } catch (err) {
            console.error("Update Product Error:", err.response || err);
            const errorData = err.response?.data; let errorMessage = 'Error updating product.';
             if (err.response?.status === 404) errorMessage = 'Product not found.';
            else if (typeof errorData === 'string' && errorData) errorMessage = errorData;
            else if (errorData?.message) errorMessage = errorData.message;
            else if (err.message) errorMessage = err.message;
            toast.error(`Update failed: ${errorMessage}`);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleOpenDeleteModal = (productId, productName) => {
        console.log(`Opening Delete Modal for product: ID=${productId}, Name=${productName}`);
        if (!productId) { console.error("Delete failed: Product ID missing."); toast.error("Cannot delete: ID missing."); return; }
        setProductToDelete({ id: productId, name: productName || `ID: ${productId}` });
        setShowDeleteModal(true);
    };
    const handleCloseDeleteModal = () => {
        console.log("Closing Delete Modal");
        setShowDeleteModal(false);
        setProductToDelete(null);
        setIsDeleting(false);
    };
    const handleConfirmDelete = async () => {
        if (!productToDelete || !productToDelete.id) {
            toast.error("Deletion failed: Target product info missing."); handleCloseDeleteModal(); return;
        }
        const { id: productId, name: productName } = productToDelete;
        console.log(`Confirmed delete for product: ID=${productId}, Name=${productName}`);
        setIsDeleting(true);

        const config = getAuthConfig(null);
        if (!config) { setIsDeleting(false); return; }

        console.log(`Proceeding with DELETE request for ID: ${productId}`);

        try {
            await axios.delete(`${API_BASE_URL}/Product/${productId}`, config);
            console.log("Product deletion successful via API for ID:", productId);
            toast.success(`Product "${productName}" deleted successfully!`);

            setProducts(prevProducts => prevProducts.filter(p => p.productId !== productId));
            handleCloseDeleteModal();

        } catch (err) {
            console.error("Delete Product Error:", err.response || err);
            const errorData = err.response?.data; let errorMessage = 'Error deleting product.';
            if (err.response?.status === 404) { errorMessage = 'Product not found. Maybe already deleted?'; setProducts(prevProducts => prevProducts.filter(p => p.productId !== productId)); }
            else if (typeof errorData === 'string' && errorData) errorMessage = errorData;
            else if (errorData?.message) errorMessage = errorData.message;
            else if (err.message) errorMessage = err.message;
            toast.error(`Deletion failed: ${errorMessage}`);
            handleCloseDeleteModal();
        }
    };

    const isLoading = loadingProducts || loadingDependencies;
    const overallError = productError || dependencyError;
    const cannotOperate = loadingDependencies || !!dependencyError || !suppliers.length || !categories.length;
    const isOperationRunning = isCreating || isUpdating || isDeleting;

    console.log('Rendering ProductList - Checks:', {
        isLoading,
        overallError: !!overallError,
        showCreateModal,
        showEditModal,
        loadingDependencies,
        dependencyError: !!dependencyError,
        suppliersLength: suppliers.length,
        categoriesLength: categories.length,
        cannotOperate,
        isCreating,
        isUpdating,
        isDeleting,
        isOperationRunning
    });

    return (
        <div className="container mt-4">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h2>All Products</h2>
                <Button
                    variant="success"
                    onClick={handleOpenCreateModal}
                    disabled={cannotOperate || isOperationRunning}
                    title={cannotOperate ? `Cannot create: ${dependencyError || 'Loading dependencies...'}` : 'Create New Product'}
                >
                   Create Product
                   {loadingDependencies && !dependencyError && <Spinner as="span" animation="border" size="sm" className="ms-1" />}
                </Button>
            </div>

            <ToastContainer position="top-right" autoClose={4000} hideProgressBar={false} newestOnTop theme="colored" closeOnClick pauseOnFocusLoss draggable pauseOnHover />

            {isLoading && (
                <div className="text-center my-5">
                    <Spinner animation="border" role="status" variant="primary"><span className="visually-hidden">Loading...</span></Spinner>
                    <p className="mt-2 text-muted">Loading data...</p>
                </div>
            )}

            {overallError && !isLoading && (
                <Alert variant="danger" className="mt-3">
                    <Alert.Heading>Error Loading Data</Alert.Heading>
                    {overallError.split('\n').map((line, i) => line.trim() && <p key={i} className="mb-1">{line.trim()}</p>)}
                    {!getCompanyId() && !isLoading && <p className="mb-1 fw-bold">Company ID is missing in cookies.</p>}
                    <hr />
                    <Button variant="outline-danger" size="sm" onClick={() => fetchData(true)} disabled={isLoading}>Retry Fetch</Button>
                </Alert>
            )}

            {!isLoading && !overallError && (
                 products.length > 0 ? (
                    <div className="table-responsive mt-3">
                        <Table striped bordered hover responsive="sm">
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
                                    <th>Storehouse</th>
                                    <th>Company</th>
                                    <th style={{ minWidth: '180px', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((product) => (
                                    <tr key={product.productId}>
                                        <td style={{ width: '80px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {product.photo ? (
                                                <Image
                                                    src={`${PHOTO_BASE_URL}${product.photo.startsWith('/') ? '' : '/'}${product.photo}`}
                                                    alt={product.name || 'Product'}
                                                    thumbnail
                                                    style={{ maxHeight: '60px', maxWidth: '60px', objectFit: 'contain' }}
                                                    onError={(e) => { e.currentTarget.src = '/placeholder.png'; e.currentTarget.style.objectFit = 'scale-down'; }}
                                                    loading="lazy"
                                                />
                                             ) : ( <span className="text-muted small">No Photo</span> )}
                                        </td>
                                        <td style={{ verticalAlign: 'middle' }}>{product.name || 'N/A'}</td>
                                        <td style={{ verticalAlign: 'middle' }}>{product.stock ?? 'N/A'}</td>
                                        <td style={{ verticalAlign: 'middle' }}>{(typeof product.price === 'number') ? `$${product.price.toFixed(2)}` : 'N/A'}</td>
                                        <td style={{ verticalAlign: 'middle' }}>{formatDateForDisplay(product.expiryDate)}</td>
                                        <td style={{ verticalAlign: 'middle' }}>
                                            {product.supplier?.name ?? supplierMap[product.supplierId] ?? <small title={product.supplierId}>ID: {product.supplierId?.substring(0, 8)}...</small>}
                                        </td>
                                        <td style={{ verticalAlign: 'middle' }}>
                                            {product.category?.name ?? categoryMap[product.categoryId] ?? <small title={product.categoryId}>ID: {product.categoryId?.substring(0, 8)}...</small>}
                                        </td>
                                        <td style={{ verticalAlign: 'middle' }}>
                                            {product.section?.name || (product.sectionId ? `ID: ${product.sectionId}` : 'N/A')}
                                        </td>
                                        <td style={{ verticalAlign: 'middle' }}>
                                            {product.section?.storehouses?.storehouseName || 'N/A'}
                                        </td>
                                        <td style={{ verticalAlign: 'middle' }}>
                                            {product.section?.storehouses?.companies?.name || 'N/A'}
                                        </td>
                                        <td style={{ verticalAlign: 'middle' }}>
                                            <div className="d-flex gap-2 justify-content-center flex-wrap">
                                                <Button size="sm" variant="outline-primary" onClick={() => handleOpenEditModal(product)} disabled={cannotOperate || isOperationRunning} title={cannotOperate ? `Cannot edit: ${dependencyError || 'Loading...'}` : 'Edit Product'}>
                                                    Edit
                                                </Button>
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
                ) : (
                    !productError && products.length === 0 ? (
                         <Alert variant="info" className="mt-3 text-center">No products found for your company. Use the 'Create Product' button to add one.</Alert>
                    ) : null
                )
            )}


            <Modal show={showCreateModal} onHide={handleCloseCreateModal} backdrop="static" keyboard={false} centered size="lg">
                <Modal.Header closeButton><Modal.Title>Create New Product</Modal.Title></Modal.Header>
                <Form onSubmit={handleCreateSubmit} ref={createFormRef}>
                    <Modal.Body>
                        <Form.Group className="mb-3" controlId="createProductName"><Form.Label>Name *</Form.Label><Form.Control type="text" name="name" value={newProduct.name} onChange={handleCreateInputChange} required autoFocus /></Form.Group>
                        <Row><Col md={6}><Form.Group className="mb-3" controlId="createProductStock"><Form.Label>Stock *</Form.Label><Form.Control type="number" step="any" name="stock" value={newProduct.stock} onChange={handleCreateInputChange} required placeholder="e.g., 10 or 5.5" /></Form.Group></Col><Col md={6}><Form.Group className="mb-3" controlId="createProductPrice"><Form.Label>Price *</Form.Label><Form.Control type="number" name="price" value={newProduct.price} onChange={handleCreateInputChange} required min="0" step="0.01" placeholder="e.g., 19.99"/></Form.Group></Col></Row>
                        <Form.Group className="mb-3" controlId="createProductExpiryDate"><Form.Label>Expiry Date *</Form.Label><Form.Control type="date" name="expiryDate" value={newProduct.expiryDate} onChange={handleCreateInputChange} required /></Form.Group>
                        <Form.Group className="mb-3" controlId="createProductSupplier"><Form.Label>Supplier *</Form.Label><Form.Select name="supplierId" value={newProduct.supplierId} onChange={handleCreateInputChange} required aria-label="Select Supplier"><option value="">Select Supplier...</option>{suppliers.map(s => (<option key={s.supplierId} value={s.supplierId}>{s.name || `ID: ${s.supplierId}`}</option>))}</Form.Select></Form.Group>
                        <Form.Group className="mb-3" controlId="createProductCategory"><Form.Label>Category *</Form.Label><Form.Select name="categoryId" value={newProduct.categoryId} onChange={handleCreateInputChange} required aria-label="Select Category"><option value="">Select Category...</option>{categories.map(c => (<option key={c.categoryId} value={c.categoryId}>{c.name || `ID: ${c.categoryId}`}</option>))}</Form.Select></Form.Group>
                        <Form.Group controlId="createProductPhoto" className="mb-3"><Form.Label>Product Photo (Optional)</Form.Label><Form.Control type="file" name="photoFile" onChange={handlePhotoFileChange} accept="image/*" /></Form.Group>
                        <Form.Group className="mb-3" controlId="createProductSection"><Form.Label>Section (Optional)</Form.Label><Form.Select name="sectionId" value={newProduct.sectionId} onChange={handleCreateInputChange} aria-label="Select Section"><option value="">No Section</option>{sections.map(sec => (<option key={sec.sectionId} value={sec.sectionId}>{sec.name || `Sec ID: ${sec.sectionId}`} - (SH: {sec.storehouses?.storehouseName || sec.storehousesId || 'N/A'})</option>))}</Form.Select></Form.Group>
                        <small className="text-muted">* Required fields</small>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseCreateModal} disabled={isCreating}>Cancel</Button>
                        <Button variant="primary" type="submit" disabled={isCreating}>{isCreating ? <><Spinner size="sm" className="me-1" />Creating...</> : 'Create Product'}</Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" keyboard={false} centered size="lg">
                <Modal.Header closeButton><Modal.Title>Edit Product {editingProduct ? `- ${editingProduct.name}` : ''}</Modal.Title></Modal.Header>
                {editingProduct && (
                    <Form onSubmit={handleUpdateSubmit}>
                        <Modal.Body>
                            {editingProduct.photo && (<div className="mb-3 text-center"><Image src={`${PHOTO_BASE_URL}${editingProduct.photo.startsWith('/') ? '' : '/'}${editingProduct.photo}`} alt="Current product" style={{ maxWidth: '150px', maxHeight: '150px', objectFit: 'contain' }} thumbnail onError={(e) => { e.currentTarget.style.display = 'none'; }}/><small className="d-block text-muted mt-1">Current Photo (Cannot be changed here)</small></div>)}
                            <Form.Group className="mb-3" controlId="editProductName"><Form.Label>Name *</Form.Label><Form.Control type="text" name="name" value={editingProduct.name} onChange={handleEditInputChange} required autoFocus /></Form.Group>
                            <Row>
                                <Col md={6}><Form.Group className="mb-3" controlId="editProductStock"><Form.Label>Stock *</Form.Label><Form.Control type="number" step="any" name="stock" value={editingProduct.stock} onChange={handleEditInputChange} required /></Form.Group></Col>
                                <Col md={6}><Form.Group className="mb-3" controlId="editProductPrice"><Form.Label>Price *</Form.Label><Form.Control type="number" name="price" value={editingProduct.price} onChange={handleEditInputChange} required min="0" step="0.01" /></Form.Group></Col>
                            </Row>
                            <Form.Group className="mb-3" controlId="editProductExpiryDate"><Form.Label>Expiry Date *</Form.Label><Form.Control type="date" name="expiryDate" value={editingProduct.expiryDate} onChange={handleEditInputChange} required /></Form.Group>
                            <Form.Group className="mb-3" controlId="editProductSupplier"><Form.Label>Supplier *</Form.Label><Form.Select name="supplierId" value={editingProduct.supplierId} onChange={handleEditInputChange} required aria-label="Select Supplier"><option value="">Select Supplier...</option>{suppliers.map(s => (<option key={s.supplierId} value={s.supplierId}>{s.name || `ID: ${s.supplierId}`}</option>))}</Form.Select></Form.Group>
                            <Form.Group className="mb-3" controlId="editProductCategory"><Form.Label>Category *</Form.Label><Form.Select name="categoryId" value={editingProduct.categoryId} onChange={handleEditInputChange} required aria-label="Select Category"><option value="">Select Category...</option>{categories.map(c => (<option key={c.categoryId} value={c.categoryId}>{c.name || `ID: ${c.categoryId}`}</option>))}</Form.Select></Form.Group>
                            <Form.Group className="mb-3" controlId="editProductSection"><Form.Label>Section (Optional)</Form.Label><Form.Select name="sectionId" value={editingProduct.sectionId} onChange={handleEditInputChange} aria-label="Select Section"><option value="">No Section</option>{sections.map(sec => (<option key={sec.sectionId} value={sec.sectionId}>{sec.name || `Sec ID: ${sec.sectionId}`} - (SH: {sec.storehouses?.storehouseName || sec.storehousesId || 'N/A'})</option>))}</Form.Select></Form.Group>
                            <small className="text-muted">* Required fields</small>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={handleCloseEditModal} disabled={isUpdating}>Cancel</Button>
                            <Button variant="primary" type="submit" disabled={isUpdating}>{isUpdating ? <><Spinner size="sm" className="me-1" />Updating...</> : 'Save Changes'}</Button>
                        </Modal.Footer>
                    </Form>
                 )}
                 {!editingProduct && showEditModal && (<Modal.Body><div className="text-center"><Spinner animation="border" variant="primary" /></div></Modal.Body>)}
            </Modal>

             <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} centered backdrop="static" keyboard={false}>
                 <Modal.Header closeButton><Modal.Title>Confirm Deletion</Modal.Title></Modal.Header>
                 <Modal.Body>
                     Are you sure you want to delete the product: <br />
                     <strong>{productToDelete?.name || 'this item'}</strong>?
                     <p className="text-danger mt-2 mb-0"><small>This action cannot be undone.</small></p>
                 </Modal.Body>
                 <Modal.Footer>
                     <Button variant="secondary" onClick={handleCloseDeleteModal} disabled={isDeleting}>Cancel</Button>
                     <Button variant="danger" onClick={handleConfirmDelete} disabled={isDeleting}>
                         {isDeleting ? <><Spinner as="span" animation="border" size="sm" className="me-1" />Deleting...</> : 'Confirm Delete'}
                     </Button>
                 </Modal.Footer>
             </Modal>

        </div>
    );
}

export default ProductList;