import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Spinner, Alert, Image, Button } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import apiClient from '../../appService';

// NOTE: cookieUtils has been removed as it's no longer used for auth here.

const PHOTO_BASE_URL = 'https://localhost:7204';

const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? 'Invalid Date' : date.toISOString().split('T')[0];
    } catch (e) {
        return 'Invalid Date';
    }
};

const SESSION_STORAGE_KEYS = {
    // REMOVED: TOKEN and other auth keys are no longer stored/needed.
    USER_ROLE: 'userRole',
};

function ProductManagement() {
    const [searchParams] = useSearchParams();
    const sectionIdFromUrl = searchParams.get('sectionId');
    
    // All state hooks remain the same
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [productError, setProductError] = useState(null);
    const [sectionName, setSectionName] = useState('');
    const userrole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);

    // --- START OF FIX ---
    // REMOVED the outdated getAuthToken and getAuthConfig functions.
    // They are no longer necessary as authentication is handled automatically by the browser cookie.
    // --- END OF FIX ---

    // REFACTORED: Simplified fetchSectionProducts
    const fetchSectionProducts = useCallback(async (isMounted, currentSectionId) => {
        if (!currentSectionId || isNaN(parseInt(currentSectionId, 10))) {
            setProductError("A valid Section ID was not found in the URL.");
            setLoadingProducts(false);
            return;
        }

        setLoadingProducts(true);
        setProductError(null);
        setProducts([]);

        try {
            // No auth config needed. The browser sends the cookie automatically.
            const response = await apiClient.get(`/Product/section/${currentSectionId}`);
            if (isMounted) {
                if (Array.isArray(response.data)) {
                    setProducts(response.data);
                    // Determine section name from the first product, or fall back to ID
                    if (response.data.length > 0 && response.data[0].section?.name) {
                        setSectionName(response.data[0].section.name);
                    } else {
                        // If no products, we can't get the name this way. We could make another API call
                        // to get the section details, but for now, this fallback is fine.
                        setSectionName(`ID: ${currentSectionId}`);
                    }
                } else {
                    setProductError("API returned unexpected data format.");
                }
            }
        } catch (err) {
            if (isMounted) {
                const errorMsg = err.response?.data?.message || 'Failed to load products for this section.';
                setProductError(errorMsg);
            }
        } finally {
            if (isMounted) {
                setLoadingProducts(false);
            }
        }
    }, []);

    useEffect(() => {
        // We check for a role to see if the user is logged in before fetching.
        const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
        if (!userRole) {
            setProductError("You are not logged in. Please log in to view products.");
            setLoadingProducts(false);
            return;
        }

        let isMounted = true;
        fetchSectionProducts(isMounted, sectionIdFromUrl);
        return () => { isMounted = false; };
    }, [sectionIdFromUrl, fetchSectionProducts]);

    // --- The entire return JSX remains exactly the same ---
    return (
        <div className="container mt-4">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h2>
                    Products in Section: {loadingProducts ? 'Loading...' : (sectionName || (productError ? 'Error' : 'N/A'))}
                </h2>
                {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                    <Button
                        variant="success"
                        onClick={() => window.location.href = `/app/createproduct?sectionId=${sectionIdFromUrl}`}
                    >
                        <i className="bi bi-plus-circle me-2"></i>Create Product
                    </Button>
                )}
            </div>
            <ToastContainer position="top-right" autoClose={3000} />

            {loadingProducts && <div className="text-center my-3"><Spinner animation="border" /> Loading products...</div>}
            {productError && !loadingProducts && <Alert variant="danger">Error: {productError}</Alert>}
            {!loadingProducts && !productError && !sectionIdFromUrl && <Alert variant="warning">No section specified in the URL.</Alert>}
            {!loadingProducts && !productError && sectionIdFromUrl && products.length === 0 && <Alert variant="info">No products found in this section.</Alert>}

            {!loadingProducts && !productError && sectionIdFromUrl && products.length > 0 && (
                <div className="table-responsive">
                    <Table striped bordered hover responsive="sm">
                        <thead>
                            <tr>
                                <th>Photo</th><th>Name</th><th>Stock</th><th>Price</th><th>Expiry Date</th>
                                {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                                    <><th>Supplier</th><th>Category</th></>
                                )}
                                <th>Section ID</th>
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
                                    {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                                        <>
                                            <td style={{ verticalAlign: 'middle' }}>{product.supplier?.name || 'N/A'}</td>
                                            <td style={{ verticalAlign: 'middle' }}>{product.category?.name || 'N/A'}</td>
                                        </>
                                    )}
                                    <td style={{ verticalAlign: 'middle' }}>{product.sectionId ?? 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            )}
        </div>
    );
}

export default ProductManagement;