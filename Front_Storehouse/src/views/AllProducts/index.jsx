import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { Table, Spinner, Alert, Image, Button, Modal, Form, Row, Col, InputGroup, Pagination } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import cookieUtils from '../auth/cookieUtils';
import debounce from 'lodash.debounce'; // Import debounce

const API_BASE_URL = 'https://localhost:7204/api';
const PHOTO_BASE_URL = 'https://localhost:7204';

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    USER_ROLE: 'userRole',
    // ... other keys
};

const DEFAULT_PAGE_SIZE = 10;

// --- Helper Functions (formatDateForDisplay, formatDateForInput) remain the same ---
const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toISOString().split('T')[0]; // Use ISO format YYYY-MM-DD
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
             if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
                return dateString.split('T')[0];
             }
             return '';
        }
        return date.toISOString().split('T')[0]; // Use ISO format YYYY-MM-DD
    } catch (e) {
        console.error("Error formatting date for input:", dateString, e);
        return typeof dateString === 'string' ? dateString.split('T')[0] : '';
    }
};
// --- End Helper Functions ---

function ProductList() {
    // --- State for Modals, CRUD operations, Dependencies ---
    const [suppliers, setSuppliers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [sections, setSections] = useState([]);
    const [loadingDependencies, setLoadingDependencies] = useState(true);
    const [dependencyError, setDependencyError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', stock: '', expiryDate: '', price: '', supplierId: '', categoryId: '', sectionId: '' });
    const [photoFile, setPhotoFile] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const createFormRef = useRef(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null); // Will store the DTO from search results
    const [isUpdating, setIsUpdating] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const userrole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
    // --- End Modal/CRUD/Dependency State ---

    // --- State for Search, Results, Loading ---
    const [searchParams, setSearchParams] = useState({
        fullTextTerm: '',
        minPrice: '',
        maxPrice: '',
        supplierName: '', // Add other filters as needed
        categoryName: '',
        sectionName: '',
        storehouseName: '',
        sortBy: 'Name',
        sortDirection: 'ASC',
        pageNumber: 1,
        pageSize: DEFAULT_PAGE_SIZE,
    });
    const [pagedResult, setPagedResult] = useState({
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
    });
    const [loadingResults, setLoadingResults] = useState(true);
    const [resultsError, setResultsError] = useState(null);
    // --- End Search/Results State ---

    const getAuthToken = useCallback(() => sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN), []);
    const getCompanyId = useCallback(() => cookieUtils.getCompanyIdFromCookies(), []); // Keep if needed elsewhere, but search doesn't use it directly

    const getAuthConfig = useCallback((contentType = 'application/json') => {
        const token = getAuthToken();
        if (!token) {
            console.error('Auth token is missing.');
            toast.error('Authentication failed. Please log in again.');
            return null;
        }
        const headers = { Authorization: `Bearer ${token}` };
        if (contentType) {
            headers['Content-Type'] = contentType;
        }
        return { headers };
    }, [getAuthToken]);

    // --- Function to fetch search results ---
    const fetchSearchResults = useCallback(async (currentSearchParams) => {
        console.log("Fetching search results with params:", currentSearchParams);
        setLoadingResults(true);
        setResultsError(null);

        const config = getAuthConfig();
        if (!config) {
            setLoadingResults(false);
            setResultsError("Authentication configuration failed.");
            return;
        }

        // Clean up params: remove empty strings, convert numbers
        const paramsToSend = {};
        for (const key in currentSearchParams) {
            const value = currentSearchParams[key];
            if (value !== null && value !== '') {
                 if (['pageNumber', 'pageSize', 'minPrice', 'maxPrice', 'minStock'].includes(key)) {
                     const num = parseFloat(value);
                     if (!isNaN(num)) paramsToSend[key] = num;
                 } else if (['minExpiryDate', 'maxExpiryDate'].includes(key)) {
                     // Ensure date format if needed, though backend might handle YYYY-MM-DD
                     paramsToSend[key] = value;
                 }
                 else {
                    paramsToSend[key] = value;
                 }
            }
        }

        // Ensure required pagination params have defaults if missing
        paramsToSend.pageNumber = paramsToSend.pageNumber || 1;
        paramsToSend.pageSize = paramsToSend.pageSize || DEFAULT_PAGE_SIZE;

        try {
            const response = await axios.get(`${API_BASE_URL}/Product/search`, {
                headers: config.headers,
                params: paramsToSend // Axios handles query string construction
            });
            console.log("Search results received:", response.data);
            setPagedResult(response.data);
        } catch (err) {
            console.error("Error fetching search results:", err.response || err);
            const errorMsg = err.response?.data?.title || err.response?.data || err.message || 'Failed to fetch search results.';
            setResultsError(errorMsg);
            setPagedResult({ // Reset results on error
                items: [], totalCount: 0, pageNumber: 1, pageSize: DEFAULT_PAGE_SIZE,
                totalPages: 0, hasPreviousPage: false, hasNextPage: false,
            });
            toast.error(`Error: ${errorMsg}`);
        } finally {
            setLoadingResults(false);
        }
    }, [getAuthConfig]); // Add other dependencies if they influence the fetch logic itself

    // --- Function to fetch dependencies (Suppliers, Categories, Sections) ---
    const fetchDependencies = useCallback(async (isMounted) => {
        console.log("Fetching dependencies (Suppliers, Categories, Sections)...");
        if (!isMounted) return;
        setLoadingDependencies(true);
        setDependencyError(null);

        const config = getAuthConfig();
        if (!config) {
             if (isMounted) { setLoadingDependencies(false); setDependencyError("Auth config failed for dependencies."); }
             return;
        }

        try {
             const [suppliersResponse, categoriesResponse, sectionsResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/Suppliers`, config).catch(err => ({ error: true, data: err, type: 'Suppliers' })),
                axios.get(`${API_BASE_URL}/Categories`, config).catch(err => ({ error: true, data: err, type: 'Categories' })),
                axios.get(`${API_BASE_URL}/Sections`, config).catch(err => ({ error: true, data: err, type: 'Sections' }))
             ]);

             if (!isMounted) return;

             let depErrorMsg = '';
             const getErrorMessage = (err, entityName) => err.response?.data || err.message || `Failed to load ${entityName}.`;

             const processDep = (resp, setData, name) => {
                 if (resp.error) { const msg = getErrorMessage(resp.data, name); console.error(`Error fetching ${name}:`, resp.data.response?.status, msg, resp.data); depErrorMsg += `${name}: ${msg}\n`; setData([]); return false; }
                 else if (Array.isArray(resp.data)) { setData(resp.data); console.log(`${name} fetched successfully: ${resp.data.length} items.`); return true; }
                 else { const msg = `${name}: Unexpected data format.`; console.error(msg, "Received:", resp.data); depErrorMsg += `${msg}\n`; setData([]); return false; }
             };

             processDep(suppliersResponse, setSuppliers, 'Suppliers');
             processDep(categoriesResponse, setCategories, 'Categories');
             processDep(sectionsResponse, setSections, 'Sections');

             if (depErrorMsg) { setDependencyError(depErrorMsg.trim()); toast.error("Failed to load some required data for forms.", { toastId: 'dep-load-error' });}

        } catch (generalError) {
             if (isMounted) {
                 console.error("General error fetching dependencies:", generalError);
                 setDependencyError("An unexpected error occurred loading form data.");
                 toast.error("An unexpected error occurred loading form data.");
             }
        } finally {
             if (isMounted) setLoadingDependencies(false);
        }
    }, [getAuthConfig]); // Include dependencies for dependency fetching

    // --- Initial Data Load Effect ---
    useEffect(() => {
        console.log("ProductList component mounted, running initial data fetch effect.");
        let isMounted = true;
        fetchSearchResults(searchParams); // Fetch initial search results
        fetchDependencies(isMounted); // Fetch dependencies for modals
        return () => {
            console.log("ProductList component unmounting.");
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchSearchResults, fetchDependencies]); // Run only once on mount

    // --- Effect to Fetch Results When Search Params Change ---
    // Debounce the fetch call triggered by search param changes
    const debouncedFetchSearchResults = useCallback(debounce(fetchSearchResults, 500), [fetchSearchResults]);

    useEffect(() => {
        // Don't fetch on initial mount again, the first useEffect handles that.
        // Check if params actually changed if needed, or rely on debounce.
        // We use the debounced version here.
        console.log("Search params changed, triggering debounced fetch:", searchParams);
        debouncedFetchSearchResults(searchParams);

        // Cleanup function for debounce
        return () => {
            debouncedFetchSearchResults.cancel();
        };
    }, [searchParams, debouncedFetchSearchResults]);

    // --- Event Handlers for Search/Filter/Sort/Pagination ---
    const handleSearchInputChange = (e) => {
        const { name, value } = e.target;
        setSearchParams(prev => ({
            ...prev,
            [name]: value,
            pageNumber: 1, // Reset to page 1 when filters change
        }));
    };

    const handleSortChange = (newSortBy) => {
        setSearchParams(prev => {
            const newDirection = prev.sortBy === newSortBy && prev.sortDirection === 'ASC' ? 'DESC' : 'ASC';
            return {
                ...prev,
                sortBy: newSortBy,
                sortDirection: newDirection,
                pageNumber: 1, // Reset to page 1 on sort change
            };
        });
    };

    const handlePageChange = (newPageNumber) => {
        if (newPageNumber >= 1 && newPageNumber <= pagedResult.totalPages) {
            setSearchParams(prev => ({
                ...prev,
                pageNumber: newPageNumber,
            }));
        }
    };

    const handlePageSizeChange = (e) => {
         const newSize = parseInt(e.target.value, 10);
         if (newSize > 0) {
             setSearchParams(prev => ({
                 ...prev,
                 pageSize: newSize,
                 pageNumber: 1, // Reset page number when size changes
             }));
         }
     };
    // --- End Search/Filter/Sort/Pagination Handlers ---

    // --- CRUD Handlers (handleOpenCreateModal, handleCloseCreateModal, etc.) ---
    // Keep these largely the same, but adjust post-action refresh
    const handleOpenCreateModal = () => {
        setNewProduct({ name: '', stock: '', expiryDate: '', price: '', supplierId: '', categoryId: '', sectionId: '' });
        setPhotoFile(null);
        if (createFormRef.current) createFormRef.current.reset();
        setShowCreateModal(true);
    };
    const handleCloseCreateModal = () => { setShowCreateModal(false); setIsCreating(false); /* Reset state */ };
    const handleCreateInputChange = (e) => {/* ... */ const { name, value } = e.target; setNewProduct(prev => ({ ...prev, [name]: value }));};
    const handlePhotoFileChange = (e) => {/* ... */ if (e.target.files) setPhotoFile(e.target.files[0]);};
    const handleCreateSubmit = async (e) => {
        e.preventDefault(); setIsCreating(true);
        // Validation...
        const { name, stock, expiryDate, price, supplierId, categoryId, sectionId } = newProduct;
        const parsedPrice = parseFloat(price); const parsedStock = parseFloat(stock); let parsedSectionId = sectionId ? parseInt(sectionId, 10) : null;
        if (!name || !stock || !expiryDate || !price || !supplierId || !categoryId /* ... more checks */) {
            toast.warn('Please fill required fields.'); setIsCreating(false); return;
        }

        const formData = new FormData();
        formData.append('Name', name); formData.append('Stock', parsedStock); formData.append('ExpiryDate', expiryDate);
        formData.append('Price', parsedPrice); formData.append('SupplierId', supplierId); formData.append('CategoryId', categoryId);
        if (parsedSectionId !== null) formData.append('SectionId', parsedSectionId);
        if (photoFile) formData.append('PhotoFile', photoFile);

        const config = getAuthConfig(null); // Content-Type set by FormData
        if (!config) { setIsCreating(false); return; }

        try {
            const response = await axios.post(`${API_BASE_URL}/Product`, formData, config);
            toast.success(`Product "${response.data.name}" created!`);
            handleCloseCreateModal();
            fetchSearchResults(searchParams); // <-- Refresh current search results
        } catch (err) {
            // Error handling...
            console.error("Create Error:", err.response || err); toast.error("Creation failed.");
        } finally {
            setIsCreating(false);
        }
    };

     const handleOpenEditModal = (productDto) => { // Now receives ProductSearchResultDto
        if (!productDto) { toast.error("Cannot edit: data missing."); return; }
        console.log("Opening edit modal for:", productDto);
         // Map DTO to state needed for the form
         const productToEdit = {
            productId: productDto.productId,
            name: productDto.name || '',
            stock: productDto.stock != null ? productDto.stock.toString() : '',
            expiryDate: formatDateForInput(productDto.expiryDate),
            price: productDto.price != null ? productDto.price.toString() : '',
            photo: productDto.photo, // Keep photo path for display
            supplierId: productDto.supplierId || '', // Use IDs for form selects
            categoryId: productDto.categoryId || '',
            sectionId: productDto.sectionId != null ? productDto.sectionId.toString() : '',
         };
         console.log("Setting editingProduct state:", productToEdit);
         setEditingProduct(productToEdit);
         setShowEditModal(true);
    };
    const handleCloseEditModal = () => { setShowEditModal(false); setEditingProduct(null); setIsUpdating(false); };
    const handleEditInputChange = (e) => {/* ... */ if (!editingProduct) return; const { name, value } = e.target; setEditingProduct(prev => ({ ...prev, [name]: value }));};
    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        if (!editingProduct || !editingProduct.productId) { toast.error("Update failed: Invalid data."); return; }
        setIsUpdating(true);
        // Validation...
        const { productId, name, stock, expiryDate, price, photo, supplierId, categoryId, sectionId } = editingProduct;
        const parsedPrice = parseFloat(price); const parsedStock = parseFloat(stock); let parsedSectionId = sectionId ? parseInt(sectionId, 10) : null;
         if (!name || !stock || !expiryDate || !price || !supplierId || !categoryId /* ... more checks */) {
             toast.warn('Please fill required fields.'); setIsUpdating(false); return;
         }

        const updatedProductData = { // This structure should match the backend's expected Product model for PUT
             productId: productId, name: name.trim(), stock: parsedStock, expiryDate: expiryDate,
             price: parsedPrice, photo: photo, // Send existing photo path back
             supplierId: supplierId, categoryId: categoryId, sectionId: parsedSectionId
        };

        const config = getAuthConfig('application/json');
        if (!config) { setIsUpdating(false); return; }

        try {
            await axios.put(`${API_BASE_URL}/Product/${productId}`, updatedProductData, config);
            toast.success(`Product "${updatedProductData.name}" updated!`);
            handleCloseEditModal();
            fetchSearchResults(searchParams); // <-- Refresh current search results
        } catch (err) {
            // Error handling...
             console.error("Update Error:", err.response || err); toast.error("Update failed.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleOpenDeleteModal = (productId, productName) => {/* ... */ setProductToDelete({ id: productId, name: productName }); setShowDeleteModal(true);};
    const handleCloseDeleteModal = () => {/* ... */ setShowDeleteModal(false); setProductToDelete(null); setIsDeleting(false); };
    const handleConfirmDelete = async () => {
        if (!productToDelete?.id) return;
        setIsDeleting(true);
        const config = getAuthConfig(null);
        if (!config) { setIsDeleting(false); return; }

        try {
            await axios.delete(`${API_BASE_URL}/Product/${productToDelete.id}`, config);
            toast.success(`Product "${productToDelete.name}" deleted!`);
            handleCloseDeleteModal();
            // Refresh results. If the deleted item was the last on the page, consider going to prev page.
            const needsPageAdjustment = pagedResult.items.length === 1 && searchParams.pageNumber > 1;
            const newParams = needsPageAdjustment
                 ? { ...searchParams, pageNumber: searchParams.pageNumber - 1 }
                 : searchParams;
            fetchSearchResults(newParams); // Fetch potentially adjusted page
             if (needsPageAdjustment) setSearchParams(newParams); // Update state if page changed

        } catch (err) {
            // Error handling...
             console.error("Delete Error:", err.response || err); toast.error("Deletion failed.");
             handleCloseDeleteModal(); // Still close modal on error
        }
        // finally { // Removed finally as setIsDeleting is handled in handleCloseDeleteModal
        //     setIsDeleting(false); // Handled by handleCloseDeleteModal
        // }
    };
    // --- End CRUD Handlers ---

    const isLoading = loadingResults || loadingDependencies; // Combined loading state
    const overallError = resultsError || dependencyError; // Combined error state
    // Disable CUD buttons if dependencies are loading/failed, or another operation is running
    const cannotOperate = loadingDependencies || !!dependencyError || isCreating || isUpdating || isDeleting;
    const isOperationRunning = isCreating || isUpdating || isDeleting;

    // --- Render Logic ---
    return (
        <div className="container-fluid mt-4"> {/* Use container-fluid for more space */}
            <ToastContainer position="top-right" autoClose={4000} hideProgressBar={false} newestOnTop theme="colored" closeOnClick pauseOnFocusLoss draggable pauseOnHover />

            <h2>Products Search</h2>

            {/* --- Search and Filter Form --- */}
            <Form className="p-3 mb-4 bg-light border rounded">
                 <Row className="g-3 align-items-end">
                    <Col md={4} sm={6}>
                        <Form.Group controlId="searchFullText">
                            <Form.Label>Search Term</Form.Label>
                            <Form.Control
                                type="text"
                                name="fullTextTerm"
                                placeholder="Search name, description..."
                                value={searchParams.fullTextTerm}
                                onChange={handleSearchInputChange}
                            />
                        </Form.Group>
                    </Col>
                    <Col md={2} sm={3}>
                        <Form.Group controlId="searchMinPrice">
                            <Form.Label>Min Price</Form.Label>
                            <Form.Control
                                type="number"
                                name="minPrice"
                                placeholder="e.g., 10"
                                value={searchParams.minPrice}
                                onChange={handleSearchInputChange}
                                min="0" step="0.01"
                            />
                        </Form.Group>
                    </Col>
                     <Col md={2} sm={3}>
                        <Form.Group controlId="searchMaxPrice">
                            <Form.Label>Max Price</Form.Label>
                            <Form.Control
                                type="number"
                                name="maxPrice"
                                placeholder="e.g., 50"
                                value={searchParams.maxPrice}
                                onChange={handleSearchInputChange}
                                min="0" step="0.01"
                            />
                        </Form.Group>
                    </Col>
                     {/* Add more filter inputs here (SupplierName, CategoryName, etc.) as needed */}
                     {/* <Col md={4} sm={6}>
                        <Form.Group controlId="searchSupplierName">
                            <Form.Label>Supplier Name</Form.Label>
                            <Form.Control type="text" name="supplierName" value={searchParams.supplierName} onChange={handleSearchInputChange} />
                        </Form.Group>
                     </Col> */}
                     {/* <Col md={4} sm={6}>
                         <Form.Group controlId="searchCategoryName">
                             <Form.Label>Category Name</Form.Label>
                             <Form.Control type="text" name="categoryName" value={searchParams.categoryName} onChange={handleSearchInputChange} />
                         </Form.Group>
                     </Col> */}
                     {/* Example Reset Button (Optional) */}
                     {/* <Col xs="auto">
                         <Button variant="outline-secondary" onClick={() => setSearchParams({ ...initialSearchParamsState })}>Reset Filters</Button>
                     </Col> */}
                 </Row>
            </Form>
            {/* --- End Search Form --- */}


            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                {/* Moved Create Button Here */}
                {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                    <Button
                        variant="success"
                        onClick={handleOpenCreateModal}
                        disabled={cannotOperate} // Use combined disabled state
                        title={loadingDependencies ? "Loading form data..." : dependencyError ? `Cannot create: ${dependencyError}` : 'Create New Product'}
                    >
                       Create Product
                       {loadingDependencies && !dependencyError && <Spinner as="span" animation="border" size="sm" className="ms-1" />}
                    </Button>
                )}

                {/* Sorting and Page Size Controls */}
                <div className="d-flex align-items-center gap-3">
                     <InputGroup size="sm" style={{width: 'auto'}}>
                         <InputGroup.Text>Sort By</InputGroup.Text>
                         <Form.Select
                             size="sm"
                             value={searchParams.sortBy + '|' + searchParams.sortDirection}
                             onChange={(e) => {
                                 const [newSortBy] = e.target.value.split('|');
                                 handleSortChange(newSortBy);
                             }}
                         >
                             {['Name', 'Price', 'Stock', 'ExpiryDate'].map(field => (
                                 <React.Fragment key={field}>
                                      <option value={`${field}|ASC`}>{field} (Asc)</option>
                                      <option value={`${field}|DESC`}>{field} (Desc)</option>
                                 </React.Fragment>
                             ))}
                         </Form.Select>
                     </InputGroup>
                      <InputGroup size="sm" style={{ width: 'auto' }}>
                         <InputGroup.Text>Per Page</InputGroup.Text>
                         <Form.Select
                             size="sm"
                             value={searchParams.pageSize}
                             onChange={handlePageSizeChange}
                         >
                             {[5, 10, 20, 50, 100].map(size => (
                                 <option key={size} value={size}>{size}</option>
                             ))}
                         </Form.Select>
                     </InputGroup>
                </div>
            </div>

            {/* --- Loading / Error Display --- */}
            {loadingResults && (
                <div className="text-center my-5">
                    <Spinner animation="border" role="status" variant="primary"><span className="visually-hidden">Loading results...</span></Spinner>
                </div>
            )}
             {/* Display dependency errors separately if needed, or combine */}
             {dependencyError && (
                 <Alert variant="warning">Failed to load data needed for forms: {dependencyError}</Alert>
             )}
            {resultsError && !loadingResults && (
                <Alert variant="danger">
                    <Alert.Heading>Error Loading Results</Alert.Heading>
                    <p>{resultsError}</p>
                    <Button variant="outline-danger" size="sm" onClick={() => fetchSearchResults(searchParams)} disabled={loadingResults}>Retry</Button>
                </Alert>
            )}
            {/* --- End Loading / Error Display --- */}

            {/* --- Results Table --- */}
            {!loadingResults && !resultsError && (
                 pagedResult.items.length > 0 ? (
                    <>
                        <div className="table-responsive">
                            <Table striped bordered hover responsive="sm">
                                <thead>
                                    <tr>
                                        {/* Adjust headers based on ProductSearchResultDto */}
                                        <th>Photo</th>
                                        <th>Name</th>
                                        <th>Stock</th>
                                        <th>Price</th>
                                        <th>Expiry Date</th>
                                        {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                                            <th>Supplier</th>
                                        )}
                                        <th>Category</th>
                                        <th>Section</th>
                                        <th>Storehouse</th>
                                        <th>Location</th>
                                        <th style={{ minWidth: '130px', textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedResult.items.map((product) => ( // Iterate over pagedResult.items
                                        <tr key={product.productId}>
                                            <td style={{ width: '80px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                {product.photo ? (
                                                    <Image src={`${PHOTO_BASE_URL}${product.photo.startsWith('/') ? '' : '/'}${product.photo}`} alt={product.name || 'Product'} thumbnail style={{ maxHeight: '60px', maxWidth: '60px', objectFit: 'contain' }} onError={(e) => { e.currentTarget.src = '/placeholder.png'; /*...*/ }} loading="lazy" />
                                                ) : (<span className="text-muted small">No Photo</span>)}
                                            </td>
                                            {/* Use direct DTO fields */}
                                            <td style={{ verticalAlign: 'middle' }}>{product.name || 'N/A'}</td>
                                            <td style={{ verticalAlign: 'middle' }}>{product.stock ?? 'N/A'}</td>
                                            <td style={{ verticalAlign: 'middle' }}>{(typeof product.price === 'number') ? `$${product.price.toFixed(2)}` : 'N/A'}</td>
                                            <td style={{ verticalAlign: 'middle' }}>{formatDateForDisplay(product.expiryDate)}</td>
                                            {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                                                <td style={{ verticalAlign: 'middle' }}>{product.supplierName || 'N/A'}</td>
                                            )}
                                            <td style={{ verticalAlign: 'middle' }}>{product.categoryName || 'N/A'}</td>
                                            <td style={{ verticalAlign: 'middle' }}>{product.sectionName || 'N/A'}</td>
                                            <td style={{ verticalAlign: 'middle' }}>{product.storehouseName || 'N/A'}</td>
                                            <td style={{ verticalAlign: 'middle' }}>{product.storehouseLocation || 'N/A'}</td>
                                            <td style={{ verticalAlign: 'middle' }}>
                                                <div className="d-flex gap-2 justify-content-center flex-wrap">
                                                    <Button size="sm" variant="outline-primary" onClick={() => handleOpenEditModal(product)} disabled={cannotOperate} title={cannotOperate ? "Operation unavailable" : "Edit Product"}>
                                                        Edit
                                                    </Button>
                                                    <Button size="sm" variant="outline-danger" onClick={() => handleOpenDeleteModal(product.productId, product.name)} disabled={cannotOperate} title={cannotOperate ? "Operation unavailable" : "Delete Product"}>
                                                        Delete
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>

                        {/* --- Pagination Controls --- */}
                        {pagedResult.totalPages > 1 && (
                            <div className="d-flex justify-content-center justify-content-md-end mt-3">
                                <Pagination size="sm">
                                     <Pagination.First onClick={() => handlePageChange(1)} disabled={!pagedResult.hasPreviousPage || loadingResults} />
                                     <Pagination.Prev onClick={() => handlePageChange(pagedResult.pageNumber - 1)} disabled={!pagedResult.hasPreviousPage || loadingResults} />
                                     {/* Optional: Page number indicators */}
                                     <Pagination.Item active>{`Page ${pagedResult.pageNumber} of ${pagedResult.totalPages}`}</Pagination.Item>
                                     {/* Simple page indicator, add more complex logic if needed */}
                                     <Pagination.Next onClick={() => handlePageChange(pagedResult.pageNumber + 1)} disabled={!pagedResult.hasNextPage || loadingResults} />
                                     <Pagination.Last onClick={() => handlePageChange(pagedResult.totalPages)} disabled={!pagedResult.hasNextPage || loadingResults} />
                                </Pagination>
                             </div>
                         )}
                          <div className="text-center text-md-end text-muted small mt-1">
                              Showing {pagedResult.items.length} of {pagedResult.totalCount} results.
                          </div>
                    </>
                ) : (
                    <Alert variant="info" className="mt-3 text-center">No products found matching your criteria.</Alert>
                )
            )}
            {/* --- End Results Table --- */}


            {/* --- Modals (Create, Edit, Delete) --- */}
            {/* Create Modal: Keep mostly the same, uses suppliers/categories/sections */}
            <Modal show={showCreateModal} onHide={handleCloseCreateModal} backdrop="static" keyboard={false} centered size="lg">
                 <Modal.Header closeButton><Modal.Title>Create New Product</Modal.Title></Modal.Header>
                 <Form onSubmit={handleCreateSubmit} ref={createFormRef}>
                     <Modal.Body>
                         {/* Form fields using newProduct state and suppliers/categories/sections */}
                          <Form.Group className="mb-3"><Form.Label>Name *</Form.Label><Form.Control type="text" name="name" value={newProduct.name} onChange={handleCreateInputChange} required /></Form.Group>
                          {/* Stock, Price, Expiry */}
                           <Row><Col md={6}><Form.Group className="mb-3"><Form.Label>Stock *</Form.Label><Form.Control type="number" step="any" name="stock" value={newProduct.stock} onChange={handleCreateInputChange} required /></Form.Group></Col><Col md={6}><Form.Group className="mb-3"><Form.Label>Price *</Form.Label><Form.Control type="number" name="price" value={newProduct.price} onChange={handleCreateInputChange} required min="0" step="0.01" /></Form.Group></Col></Row>
                           <Form.Group className="mb-3"><Form.Label>Expiry Date *</Form.Label><Form.Control type="date" name="expiryDate" value={newProduct.expiryDate} onChange={handleCreateInputChange} required /></Form.Group>
                           {/* Supplier, Category Selects */}
                           <Form.Group className="mb-3"><Form.Label>Supplier *</Form.Label><Form.Select name="supplierId" value={newProduct.supplierId} onChange={handleCreateInputChange} required><option value="">Select...</option>{suppliers.map(s => (<option key={s.supplierId} value={s.supplierId}>{s.name || s.supplierId}</option>))}</Form.Select></Form.Group>
                           <Form.Group className="mb-3"><Form.Label>Category *</Form.Label><Form.Select name="categoryId" value={newProduct.categoryId} onChange={handleCreateInputChange} required><option value="">Select...</option>{categories.map(c => (<option key={c.categoryId} value={c.categoryId}>{c.name || c.categoryId}</option>))}</Form.Select></Form.Group>
                           {/* Photo */}
                           <Form.Group className="mb-3"><Form.Label>Photo (Optional)</Form.Label><Form.Control type="file" name="photoFile" onChange={handlePhotoFileChange} accept="image/*" /></Form.Group>
                           {/* Section Select */}
                           <Form.Group className="mb-3"><Form.Label>Section (Optional)</Form.Label><Form.Select name="sectionId" value={newProduct.sectionId} onChange={handleCreateInputChange}><option value="">No Section</option>{sections.map(sec => (<option key={sec.sectionId} value={sec.sectionId}>{sec.name || `ID: ${sec.sectionId}`}{sec.storehouses ? ` (${sec.storehouses.storehouseName})` : ''}</option>))}</Form.Select></Form.Group>
                         <small className="text-muted">* Required fields</small>
                     </Modal.Body>
                     <Modal.Footer>
                         <Button variant="secondary" onClick={handleCloseCreateModal} disabled={isCreating}>Cancel</Button>
                         <Button variant="primary" type="submit" disabled={isCreating}>{isCreating ? <><Spinner size="sm" /> Creating...</> : 'Create'}</Button>
                     </Modal.Footer>
                 </Form>
             </Modal>

            {/* Edit Modal: Keep mostly the same, uses editingProduct state and suppliers/categories/sections */}
             <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" keyboard={false} centered size="lg">
                 <Modal.Header closeButton><Modal.Title>Edit Product {editingProduct ? `- ${editingProduct.name}` : ''}</Modal.Title></Modal.Header>
                 {editingProduct ? (
                     <Form onSubmit={handleUpdateSubmit}>
                         <Modal.Body>
                             {/* Display current photo */}
                             {editingProduct.photo && (<div className="mb-3 text-center"><Image src={`${PHOTO_BASE_URL}${editingProduct.photo.startsWith('/') ? '' : '/'}${editingProduct.photo}`} alt="Current" style={{ maxHeight: '150px', objectFit: 'contain' }} thumbnail /><small className="d-block text-muted mt-1">Current Photo</small></div>)}
                             {/* Form fields using editingProduct state and suppliers/categories/sections */}
                               <Form.Group className="mb-3"><Form.Label>Name *</Form.Label><Form.Control type="text" name="name" value={editingProduct.name} onChange={handleEditInputChange} required /></Form.Group>
                               <Row><Col md={6}><Form.Group className="mb-3"><Form.Label>Stock *</Form.Label><Form.Control type="number" step="any" name="stock" value={editingProduct.stock} onChange={handleEditInputChange} required /></Form.Group></Col><Col md={6}><Form.Group className="mb-3"><Form.Label>Price *</Form.Label><Form.Control type="number" name="price" value={editingProduct.price} onChange={handleEditInputChange} required min="0" step="0.01" /></Form.Group></Col></Row>
                               <Form.Group className="mb-3"><Form.Label>Expiry Date *</Form.Label><Form.Control type="date" name="expiryDate" value={editingProduct.expiryDate} onChange={handleEditInputChange} required /></Form.Group>
                               <Form.Group className="mb-3"><Form.Label>Supplier *</Form.Label><Form.Select name="supplierId" value={editingProduct.supplierId} onChange={handleEditInputChange} required><option value="">Select...</option>{suppliers.map(s => (<option key={s.supplierId} value={s.supplierId}>{s.name || s.supplierId}</option>))}</Form.Select></Form.Group>
                               <Form.Group className="mb-3"><Form.Label>Category *</Form.Label><Form.Select name="categoryId" value={editingProduct.categoryId} onChange={handleEditInputChange} required><option value="">Select...</option>{categories.map(c => (<option key={c.categoryId} value={c.categoryId}>{c.name || c.categoryId}</option>))}</Form.Select></Form.Group>
                               <Form.Group className="mb-3"><Form.Label>Section (Optional)</Form.Label><Form.Select name="sectionId" value={editingProduct.sectionId} onChange={handleEditInputChange}><option value="">No Section</option>{sections.map(sec => (<option key={sec.sectionId} value={sec.sectionId}>{sec.name || `ID: ${sec.sectionId}`}{sec.storehouses ? ` (${sec.storehouses.storehouseName})` : ''}</option>))}</Form.Select></Form.Group>
                             <small className="text-muted">* Required fields</small>
                         </Modal.Body>
                         <Modal.Footer>
                             <Button variant="secondary" onClick={handleCloseEditModal} disabled={isUpdating}>Cancel</Button>
                             <Button variant="primary" type="submit" disabled={isUpdating}>{isUpdating ? <><Spinner size="sm" /> Updating...</> : 'Save Changes'}</Button>
                         </Modal.Footer>
                     </Form>
                 ) : (<Modal.Body><div className="text-center"><Spinner /></div></Modal.Body>)}
             </Modal>

             {/* Delete Modal: Remains the same */}
             <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} centered backdrop="static" keyboard={false}>
                 <Modal.Header closeButton><Modal.Title>Confirm Deletion</Modal.Title></Modal.Header>
                 <Modal.Body>
                     Are you sure you want to delete: <strong>{productToDelete?.name || 'this item'}</strong>?
                     <p className="text-danger mt-2 mb-0"><small>This cannot be undone.</small></p>
                 </Modal.Body>
                 <Modal.Footer>
                     <Button variant="secondary" onClick={handleCloseDeleteModal} disabled={isDeleting}>Cancel</Button>
                     <Button variant="danger" onClick={handleConfirmDelete} disabled={isDeleting}>
                         {isDeleting ? <><Spinner size="sm" /> Deleting...</> : 'Confirm Delete'}
                     </Button>
                 </Modal.Footer>
             </Modal>
            {/* --- End Modals --- */}

        </div>
    );
}

export default ProductList;