import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils';
import { Table, Spinner, Alert, Image, Button } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const API_BASE_URL = 'https://localhost:7204/api';
const PHOTO_BASE_URL = 'https://localhost:7204';

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

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

function ProductManagement() {
    const [searchParams] = useSearchParams();
    const sectionIdFromUrl = searchParams.get('sectionId');

    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [productError, setProductError] = useState(null);
    const [sectionName, setSectionName] = useState('');
    const userrole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);

    const getAuthToken = useCallback(() => sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN), []);

    const getAuthConfig = useCallback((contentType = 'application/json') => {
        const token = getAuthToken();
        if (!token) {
            console.error('Auth token is missing from cookies.');
            toast.error('Authentication failed. Please log in again.');
            setProductError('Authentication token not found.');
            setLoadingProducts(false);
            return null;
        }
        const headers = { Authorization: `Bearer ${token}` };
        if (contentType) {
            headers['Content-Type'] = contentType;
        }
        return { headers };
    }, [getAuthToken]);

    const fetchSectionProducts = useCallback(async (isMounted, currentSectionId) => {
        if (!currentSectionId) {
            setProductError("Section ID not found in URL. Please navigate from a valid section.");
            setLoadingProducts(false);
            setProducts([]);
            setSectionName('');
            return;
        }
         if (isNaN(parseInt(currentSectionId, 10))) {
             setProductError(`Invalid Section ID in URL: "${currentSectionId}".`);
             setLoadingProducts(false);
             setProducts([]);
             setSectionName('');
             return;
         }

        console.log(`Fetching products for Section ID from URL: ${currentSectionId}`);
        setLoadingProducts(true);
        setProductError(null);
        setProducts([]);

        const config = getAuthConfig();
        if (!config) {
            if (isMounted) setLoadingProducts(false);
            return;
        }

        const url = `${API_BASE_URL}/Product/section/${currentSectionId}`;

        try {
            const response = await axios.get(url, config);
            if (isMounted) {
                if (response && Array.isArray(response.data)) {
                    setProducts(response.data);
                    if (response.data.length > 0 && response.data[0].section?.name) {
                        setSectionName(response.data[0].section.name);
                    } else {
                        setSectionName(`ID: ${currentSectionId}`);
                    }
                    console.log(`Fetched ${response.data.length} products for section ${currentSectionId}.`);
                } else {
                    console.error("Products API did not return an array:", response?.data);
                    setProductError("API returned unexpected data format.");
                    setProducts([]);
                    setSectionName('');
                }
            }
        } catch (err) {
            if (isMounted) {
                console.error(`Error fetching products for Section ${currentSectionId}:`, err);
                const errorData = err.response?.data;
                let errorMsg = 'Failed to load products.';
                if (typeof errorData === 'string' && errorData) {
                     errorMsg = errorData;
                } else if (err.response?.status === 404) {
                    errorMsg = `Section with ID ${currentSectionId} not found or has no products.`;
                    setSectionName('');
                } else if (err.message) {
                    errorMsg = err.message;
                }
                setProductError(errorMsg);
                setProducts([]);
                setSectionName('');
            }
        } finally {
            if (isMounted) {
                setLoadingProducts(false);
            }
        }
    }, [getAuthConfig]);

    useEffect(() => {
        let isMounted = true;
        fetchSectionProducts(isMounted, sectionIdFromUrl);

        return () => { isMounted = false; };
    }, [sectionIdFromUrl, fetchSectionProducts]);

    return (
        <div className="container mt-4">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h2>
                    Products in Section: {loadingProducts ? 'Loading...' : (sectionName || (sectionIdFromUrl ? `ID: ${sectionIdFromUrl}` : '') || (productError ? 'Error' : 'N/A'))}
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
                                <th>Photo</th>
                                <th>Name</th>
                                <th>Stock</th>
                                <th>Price</th>
                                <th>Expiry Date</th>
                                {(userrole === 'CompanyManager' || userrole === 'StorehouseManager') && (
                                    <>
                                        <th>Supplier</th>
                                        <th>Category</th>
                                    </>
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