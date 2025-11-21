import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Spinner, Alert, Image, Button, Modal, Form, Row, Col, InputGroup, Pagination } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import debounce from 'lodash.debounce';
import apiClient from '../../appService';

const PHOTO_BASE_URL = 'https://localhost:7204';

const SESSION_STORAGE_KEYS = {
    USER_ROLE: 'userRole',
};

const DEFAULT_PAGE_SIZE = 10;

const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toISOString().split('T')[0];
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
        return date.toISOString().split('T')[0];
    } catch (e) {
        console.error("Error formatting date for input:", dateString, e);
        return typeof dateString === 'string' ? dateString.split('T')[0] : '';
    }
};

function ProductList() {
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
    const [editingProduct, setEditingProduct] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const userrole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
    const [searchParams, setSearchParams] = useState({
        fullTextTerm: '', minPrice: '', maxPrice: '',
        supplierName: '', categoryName: '', sectionName: '', storehouseName: '',
        sortBy: 'Name', sortDirection: 'ASC', pageNumber: 1, pageSize: DEFAULT_PAGE_SIZE,
    });
    const [pagedResult, setPagedResult] = useState({
        items: [], totalCount: 0, pageNumber: 1, pageSize: DEFAULT_PAGE_SIZE,
        totalPages: 0, hasPreviousPage: false, hasNextPage: false,
    });
    const [loadingResults, setLoadingResults] = useState(true);
    const [resultsError, setResultsError] = useState(null);

    const fetchSearchResults = useCallback(async (currentSearchParams) => {
        setLoadingResults(true);
        setResultsError(null);

        const paramsToSend = { pageNumber: 1, pageSize: DEFAULT_PAGE_SIZE };
        for (const key in currentSearchParams) {
            const value = currentSearchParams[key];
            if (value !== null && value !== '') {
                if (['pageNumber', 'pageSize', 'minPrice', 'maxPrice', 'minStock'].includes(key)) {
                    const num = parseFloat(value);
                    if (!isNaN(num)) paramsToSend[key] = num;
                } else {
                    paramsToSend[key] = value;
                }
            }
        }

        try {
            const response = await apiClient.get('/Product/search', {
                params: paramsToSend
            });
            setPagedResult(response.data);
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Failed to fetch search results.';
            setResultsError(errorMsg);
            toast.error(`Search Error: ${errorMsg}`);
        } finally {
            setLoadingResults(false);
        }
    }, []);

    const fetchDependencies = useCallback(async (isMounted) => {
        if (!isMounted) return;
        setLoadingDependencies(true);
        setDependencyError(null);

        try {
            const [suppliersResponse, categoriesResponse, sectionsResponse] = await Promise.all([
                apiClient.get('/Suppliers').catch(err => ({ error: true, data: err, type: 'Suppliers' })),
                apiClient.get('/Categories').catch(err => ({ error: true, data: err, type: 'Categories' })),
                apiClient.get('/Sections').catch(err => ({ error: true, data: err, type: 'Sections' }))
            ]);

            if (!isMounted) return;

            let depErrorMsg = '';
            const getErrorMessage = (err, entityName) => err.response?.data || err.message || `Failed to load ${entityName}.`;
            const processDep = (resp, setData, name) => {
                if (resp.error) { const msg = getErrorMessage(resp.data, name); depErrorMsg += `${name}: ${msg}\n`; setData([]); return false; }
                else if (Array.isArray(resp.data)) { setData(resp.data); return true; }
                else { const msg = `${name}: Unexpected data format.`; depErrorMsg += `${msg}\n`; setData([]); return false; }
            };
            processDep(suppliersResponse, setSuppliers, 'Suppliers');
            processDep(categoriesResponse, setCategories, 'Categories');
            processDep(sectionsResponse, setSections, 'Sections');
            if (depErrorMsg) { setDependencyError(depErrorMsg.trim()); toast.error("Failed to load some form data."); }
        } catch (generalError) {
            if (isMounted) {
                setDependencyError("An unexpected error occurred loading form data.");
            }
        } finally {
            if (isMounted) setLoadingDependencies(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        fetchSearchResults(searchParams);
        fetchDependencies(isMounted);
        return () => { isMounted = false; };
    }, [fetchSearchResults, fetchDependencies]);

    const debouncedFetchSearchResults = useCallback(debounce(fetchSearchResults, 500), [fetchSearchResults]);
    useEffect(() => {
        debouncedFetchSearchResults(searchParams);
        return () => debouncedFetchSearchResults.cancel();
    }, [searchParams, debouncedFetchSearchResults]);

    const handleSearchInputChange = (e) => { const { name, value } = e.target; setSearchParams(prev => ({ ...prev, [name]: value, pageNumber: 1 })); };
    const handleSortChange = (newSortBy) => { setSearchParams(prev => ({ ...prev, sortBy: newSortBy, sortDirection: prev.sortBy === newSortBy && prev.sortDirection === 'ASC' ? 'DESC' : 'ASC', pageNumber: 1 })); };
    const handlePageChange = (newPageNumber) => { if (newPageNumber >= 1 && newPageNumber <= pagedResult.totalPages) { setSearchParams(prev => ({ ...prev, pageNumber: newPageNumber })); } };
    const handlePageSizeChange = (e) => { const newSize = parseInt(e.target.value, 10); if (newSize > 0) { setSearchParams(prev => ({ ...prev, pageSize: newSize, pageNumber: 1 })); } };

    const handleOpenCreateModal = () => { setNewProduct({ name: '', stock: '', expiryDate: '', price: '', supplierId: '', categoryId: '', sectionId: '' }); setPhotoFile(null); if (createFormRef.current) createFormRef.current.reset(); setShowCreateModal(true); };
    const handleCloseCreateModal = () => { setShowCreateModal(false); setIsCreating(false); };
    const handleCreateInputChange = (e) => { const { name, value } = e.target; setNewProduct(prev => ({ ...prev, [name]: value })); };
    const handlePhotoFileChange = (e) => { if (e.target.files) setPhotoFile(e.target.files[0]); };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setIsCreating(true);

        const { name, stock, expiryDate, price, supplierId, categoryId, sectionId } = newProduct;
        if (!name || !stock || !expiryDate || !price || !supplierId || !categoryId) {
            toast.warn('Please fill all required fields.');
            setIsCreating(false);
            return;
        }

        const formData = new FormData();
        formData.append('Name', name);
        formData.append('Stock', stock);
        formData.append('ExpiryDate', expiryDate);
        formData.append('Price', price);
        formData.append('SupplierId', supplierId);
        formData.append('CategoryId', categoryId);
        if (sectionId) formData.append('SectionId', sectionId);
        if (photoFile) formData.append('PhotoFile', photoFile);

        try {
            const response = await apiClient.post('/Product', formData);
            toast.success(`Product "${response.data.name}" created!`);
            handleCloseCreateModal();
            fetchSearchResults(searchParams);
        } catch (err) {
            toast.error(err.response?.data?.message || "Creation failed.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleOpenEditModal = (productDto) => {
        if (!productDto) {
            toast.error("Cannot edit: data for this product is missing.");
            return;
        }

        console.log("Opening edit modal for:", productDto);

        const productToEdit = {
            productId: productDto.productId,
            name: productDto.name || '',
            stock: productDto.stock != null ? String(productDto.stock) : '',
            expiryDate: formatDateForInput(productDto.expiryDate),
            price: productDto.price != null ? String(productDto.price) : '',
            photo: productDto.photo,
            supplierId: productDto.supplierId || '',
            categoryId: productDto.categoryId || '',
            sectionId: productDto.sectionId != null ? String(productDto.sectionId) : '',
        };

        setEditingProduct(productToEdit);
        setShowEditModal(true);
    };

    const handleCloseEditModal = () => {
        setShowEditModal(false);
        setEditingProduct(null);
        setIsUpdating(false);
    };

    const handleEditInputChange = (e) => {
        if (!editingProduct)
            return;

        const { name, value } = e.target;

        setEditingProduct(prev => ({ ...prev, [name]: value }));
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        if (!editingProduct?.productId) {
            toast.error("Update failed: Invalid data.");
            return;
        }
        setIsUpdating(true);

        const { productId, name, stock, expiryDate, price, photo, supplierId, categoryId, sectionId } = editingProduct;

        const parsedPrice = parseFloat(price);
        const parsedStock = parseFloat(stock);
        let parsedSectionId = sectionId ? parseInt(sectionId, 10) : null;

        if (!name || isNaN(parsedStock) || !expiryDate || isNaN(parsedPrice) || !supplierId || !categoryId) {
            toast.warn('Please ensure all required fields are filled correctly.');
            setIsUpdating(false);
            return;
        }

        const selectedSupplier = suppliers.find(s => s.supplierId === supplierId);
        const selectedCategory = categories.find(c => c.categoryId === categoryId);
        const selectedSection = parsedSectionId ? sections.find(sec => sec.sectionId === parsedSectionId) : null;

        if (!selectedSupplier || !selectedCategory) {
            toast.error("Could not find the selected supplier or category. Please refresh the page.");
            setIsUpdating(false);
            return;
        }

        const updatedProductData = {
            productId: productId,
            name: name.trim(),
            stock: parsedStock,
            expiryDate: expiryDate,
            price: parsedPrice,
            photo: photo,
            supplierId: supplierId,
            supplier: selectedSupplier,
            categoryId: categoryId,
            category: selectedCategory,
            sectionId: parsedSectionId,
            section: selectedSection,
        };

        try {
            await apiClient.put(`/Product/${productId}`, updatedProductData, {
                headers: { 'Content-Type': 'application/json' }
            });

            toast.success(`Product "${updatedProductData.name}" updated successfully!`);
            handleCloseEditModal();
            fetchSearchResults(searchParams);
        } catch (err) {
            console.error("Update Error:", err.response || err);
            const errorMsg = err.response?.data?.title || JSON.stringify(err.response?.data?.errors) || "Update failed.";
            toast.error(errorMsg);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleOpenDeleteModal = (productId, productName) => { setProductToDelete({ id: productId, name: productName }); setShowDeleteModal(true); };
    const handleCloseDeleteModal = () => { setShowDeleteModal(false); setProductToDelete(null); setIsDeleting(false); };

    const handleConfirmDelete = async () => {
        if (!productToDelete?.id) return;
        setIsDeleting(true);
        try {
            await apiClient.delete(`/Product/${productToDelete.id}`);
            toast.success(`Product "${productToDelete.name}" deleted!`);
            handleCloseDeleteModal();
            const needsPageAdjustment = pagedResult.items.length === 1 && searchParams.pageNumber > 1;
            const newParams = needsPageAdjustment ? { ...searchParams, pageNumber: searchParams.pageNumber - 1 } : searchParams;
            fetchSearchResults(newParams);
            if (needsPageAdjustment) setSearchParams(newParams);
        } catch (err) {
            toast.error(err.response?.data?.message || "Deletion failed.");
            handleCloseDeleteModal();
        }
    };

    const isLoading = loadingResults || loadingDependencies;
    const cannotOperate = loadingDependencies || !!dependencyError || isCreating || isUpdating || isDeleting;

    return (
        <div className="container-fluid mt-4">
            <ToastContainer position="top-right" autoClose={4000} hideProgressBar={false} newestOnTop theme="colored" closeOnClick pauseOnFocusLoss draggable pauseOnHover />
            <h2>Products Search</h2>

            <Form className="p-3 mb-4 bg-light border rounded">
                <Row className="g-3 align-items-end">
                    <Col md={4} sm={6}><Form.Group><Form.Label>Search Term</Form.Label><Form.Control type="text" name="fullTextTerm" placeholder="Search name..." value={searchParams.fullTextTerm} onChange={handleSearchInputChange} /></Form.Group></Col>
                    <Col md={2} sm={3}><Form.Group><Form.Label>Min Price</Form.Label><Form.Control type="number" name="minPrice" value={searchParams.minPrice} onChange={handleSearchInputChange} min="0" step="0.01" /></Form.Group></Col>
                    <Col md={2} sm={3}><Form.Group><Form.Label>Max Price</Form.Label><Form.Control type="number" name="maxPrice" value={searchParams.maxPrice} onChange={handleSearchInputChange} min="0" step="0.01" /></Form.Group></Col>
                </Row>
            </Form>

            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                    <Button variant="success" onClick={handleOpenCreateModal} disabled={cannotOperate}>Create Product {loadingDependencies && <Spinner as="span" animation="border" size="sm" />}</Button>
                )}
                <div className="d-flex align-items-center gap-3">
                    <InputGroup size="sm" style={{ width: 'auto' }}><InputGroup.Text>Sort By</InputGroup.Text><Form.Select size="sm" value={`${searchParams.sortBy}|${searchParams.sortDirection}`} onChange={(e) => { const [newSortBy] = e.target.value.split('|'); handleSortChange(newSortBy); }}>{['Name', 'Price', 'Stock', 'ExpiryDate'].map(field => (<React.Fragment key={field}><option value={`${field}|ASC`}>{field} (Asc)</option><option value={`${field}|DESC`}>{field} (Desc)</option></React.Fragment>))}</Form.Select></InputGroup>
                    <InputGroup size="sm" style={{ width: 'auto' }}><InputGroup.Text>Per Page</InputGroup.Text><Form.Select size="sm" value={searchParams.pageSize} onChange={handlePageSizeChange}>{[5, 10, 20, 50, 100].map(size => (<option key={size} value={size}>{size}</option>))}</Form.Select></InputGroup>
                </div>
            </div>

            {loadingResults && <div className="text-center my-5"><Spinner animation="border" variant="primary" /></div>}
            {dependencyError && <Alert variant="warning">Failed to load form data: {dependencyError}</Alert>}
            {resultsError && !loadingResults && <Alert variant="danger"><Alert.Heading>Error</Alert.Heading><p>{resultsError}</p><Button variant="outline-danger" size="sm" onClick={() => fetchSearchResults(searchParams)}>Retry</Button></Alert>}

            {!loadingResults && !resultsError && (
                pagedResult.items.length > 0 ? (
                    <>
                        <div className="table-responsive">
                            <Table striped bordered hover responsive="sm">
                                <thead><tr><th>Photo</th><th>Name</th><th>Stock</th><th>Price</th>{(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && <th>Supplier</th>}<th>Category</th><th>Section</th><th>Storehouse</th><th>Location</th><th style={{ minWidth: '130px', textAlign: 'center' }}>Actions</th></tr></thead>
                                <tbody>
                                    {pagedResult.items.map((product) => (
                                        <tr key={product.productId}>
                                            <td style={{ width: '80px', textAlign: 'center' }}><Image src={`${PHOTO_BASE_URL}${product.photo}`} alt={product.name} thumbnail style={{ maxHeight: '60px' }} /></td>
                                            <td>{product.name}</td><td>{product.stock}</td><td>${product.price?.toFixed(2)}</td>
                                            {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && <td>{product.supplierName}</td>}
                                            <td>{product.categoryName}</td><td>{product.sectionName}</td><td>{product.storehouseName}</td><td>{product.storehouseLocation}</td>
                                            <td><div className="d-flex gap-2 justify-content-center flex-wrap"><Button size="sm" variant="outline-primary" onClick={() => handleOpenEditModal(product)} disabled={cannotOperate}>Edit</Button><Button size="sm" variant="outline-danger" onClick={() => handleOpenDeleteModal(product.productId, product.name)} disabled={cannotOperate}>Delete</Button></div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                        {pagedResult.totalPages > 1 && <div className="d-flex justify-content-center mt-3"><Pagination size="sm"><Pagination.First onClick={() => handlePageChange(1)} disabled={!pagedResult.hasPreviousPage} /><Pagination.Prev onClick={() => handlePageChange(pagedResult.pageNumber - 1)} disabled={!pagedResult.hasPreviousPage} /><Pagination.Item active>{`Page ${pagedResult.pageNumber} of ${pagedResult.totalPages}`}</Pagination.Item><Pagination.Next onClick={() => handlePageChange(pagedResult.pageNumber + 1)} disabled={!pagedResult.hasNextPage} /><Pagination.Last onClick={() => handlePageChange(pagedResult.totalPages)} disabled={!pagedResult.hasNextPage} /></Pagination></div>}
                        <div className="text-center text-md-end text-muted small mt-1">Showing {pagedResult.items.length} of {pagedResult.totalCount} results.</div>
                    </>
                ) : <Alert variant="info" className="mt-3 text-center">No products found matching your criteria.</Alert>
            )}

            <Modal show={showCreateModal} onHide={handleCloseCreateModal} backdrop="static" centered size="lg">
                <Modal.Header closeButton><Modal.Title>Create New Product</Modal.Title></Modal.Header>
                <Form onSubmit={handleCreateSubmit} ref={createFormRef}>
                    <Modal.Body>
                        <Form.Group className="mb-3"><Form.Label>Name *</Form.Label><Form.Control type="text" name="name" value={newProduct.name} onChange={handleCreateInputChange} required /></Form.Group>
                        <Row><Col md={6}><Form.Group className="mb-3"><Form.Label>Stock *</Form.Label><Form.Control type="number" name="stock" value={newProduct.stock} onChange={handleCreateInputChange} required /></Form.Group></Col><Col md={6}><Form.Group className="mb-3"><Form.Label>Price *</Form.Label><Form.Control type="number" name="price" value={newProduct.price} onChange={handleCreateInputChange} required min="0" step="0.01" /></Form.Group></Col></Row>
                        <Form.Group className="mb-3"><Form.Label>Expiry Date *</Form.Label><Form.Control type="date" name="expiryDate" value={newProduct.expiryDate} onChange={handleCreateInputChange} required /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Supplier *</Form.Label><Form.Select name="supplierId" value={newProduct.supplierId} onChange={handleCreateInputChange} required><option value="">Select...</option>{suppliers.map(s => (<option key={s.supplierId} value={s.supplierId}>{s.name}</option>))}</Form.Select></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Category *</Form.Label><Form.Select name="categoryId" value={newProduct.categoryId} onChange={handleCreateInputChange} required><option value="">Select...</option>{categories.map(c => (<option key={c.categoryId} value={c.categoryId}>{c.name}</option>))}</Form.Select></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Photo (Optional)</Form.Label><Form.Control type="file" name="photoFile" onChange={handlePhotoFileChange} accept="image/*" /></Form.Group>
                        <Form.Group className="mb-3"><Form.Label>Section (Optional)</Form.Label><Form.Select name="sectionId" value={newProduct.sectionId} onChange={handleCreateInputChange}><option value="">No Section</option>{sections.map(sec => (<option key={sec.sectionId} value={sec.sectionId}>{sec.name}</option>))}</Form.Select></Form.Group>
                    </Modal.Body>
                    <Modal.Footer><Button variant="secondary" onClick={handleCloseCreateModal} disabled={isCreating}>Cancel</Button><Button variant="primary" type="submit" disabled={isCreating}>{isCreating ? <><Spinner size="sm" /> Creating...</> : 'Create'}</Button></Modal.Footer>
                </Form>
            </Modal>

            <Modal show={showEditModal} onHide={handleCloseEditModal} backdrop="static" centered size="lg">
                <Modal.Header closeButton><Modal.Title>Edit Product {editingProduct?.name}</Modal.Title></Modal.Header>
                {editingProduct && (
                    <Form onSubmit={handleUpdateSubmit}>
                        <Modal.Body>
                            {editingProduct.photo && <div className="mb-3 text-center"><Image src={`${PHOTO_BASE_URL}${editingProduct.photo}`} alt="Current" style={{ maxHeight: '150px' }} thumbnail /></div>}
                            <Form.Group className="mb-3"><Form.Label>Name *</Form.Label><Form.Control type="text" name="name" value={editingProduct.name} onChange={handleEditInputChange} required /></Form.Group>
                            <Row><Col md={6}><Form.Group className="mb-3"><Form.Label>Stock *</Form.Label><Form.Control type="number" name="stock" value={editingProduct.stock} onChange={handleEditInputChange} required /></Form.Group></Col><Col md={6}><Form.Group className="mb-3"><Form.Label>Price *</Form.Label><Form.Control type="number" name="price" value={editingProduct.price} onChange={handleEditInputChange} required min="0" step="0.01" /></Form.Group></Col></Row>
                            <Form.Group className="mb-3"><Form.Label>Expiry Date *</Form.Label><Form.Control type="date" name="expiryDate" value={editingProduct.expiryDate} onChange={handleEditInputChange} required /></Form.Group>
                            <Form.Group className="mb-3"><Form.Label>Supplier *</Form.Label><Form.Select name="supplierId" value={editingProduct.supplierId} onChange={handleEditInputChange} required><option value="">Select...</option>{suppliers.map(s => (<option key={s.supplierId} value={s.supplierId}>{s.name}</option>))}</Form.Select></Form.Group>
                            <Form.Group className="mb-3"><Form.Label>Category *</Form.Label><Form.Select name="categoryId" value={editingProduct.categoryId} onChange={handleEditInputChange} required><option value="">Select...</option>{categories.map(c => (<option key={c.categoryId} value={c.categoryId}>{c.name}</option>))}</Form.Select></Form.Group>
                            <Form.Group className="mb-3"><Form.Label>Section (Optional)</Form.Label><Form.Select name="sectionId" value={editingProduct.sectionId} onChange={handleEditInputChange}><option value="">No Section</option>{sections.map(sec => (<option key={sec.sectionId} value={sec.sectionId}>{sec.name}</option>))}</Form.Select></Form.Group>
                        </Modal.Body>
                        <Modal.Footer><Button variant="secondary" onClick={handleCloseEditModal} disabled={isUpdating}>Cancel</Button><Button variant="primary" type="submit" disabled={isUpdating}>{isUpdating ? <><Spinner size="sm" /> Updating...</> : 'Save Changes'}</Button></Modal.Footer>
                    </Form>
                )}
            </Modal>

            <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} centered backdrop="static">
                <Modal.Header closeButton><Modal.Title>Confirm Deletion</Modal.Title></Modal.Header>
                <Modal.Body><p>Are you sure you want to delete: <strong>{productToDelete?.name}</strong>?</p><p className="text-danger"><small>This cannot be undone.</small></p></Modal.Body>
                <Modal.Footer><Button variant="secondary" onClick={handleCloseDeleteModal} disabled={isDeleting}>Cancel</Button><Button variant="danger" onClick={handleConfirmDelete} disabled={isDeleting}>{isDeleting ? <><Spinner size="sm" /> Deleting...</> : 'Confirm Delete'}</Button></Modal.Footer>
            </Modal>
        </div>
    );
}

export default ProductList;