import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { Form, Button, Alert, Spinner, Card, Row, Col } from 'react-bootstrap';
import apiClient from '../../appService';
// import Breadcrumb from '../../../layouts/AdminLayout/Breadcrumb'; // Assuming you might want this from SignUp1 example

// const API_COMPANIES_URL = 'https://localhost:7204/api/Companies';

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    // ... other keys if needed
};

function CompanyDetails() {
    const [companyData, setCompanyData] = useState({
        name: '',
        email: '',
        phone_Number: '',
        address: '',
        industry: '',
        numer_Biznesit: '' // Display only, not editable usually
    });
    const [originalCompanyData, setOriginalCompanyData] = useState(null); // To compare for changes or reset
    const [companyId, setCompanyId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

    const fetchCompanyDetails = useCallback(async (currentCompanyId, authToken) => {
        setIsLoading(true);
        setError(null);
        try {
            // Assuming your /my-company endpoint gets the company based on the authenticated manager
            // Or if you directly get companyId from token, you could use /api/Companies/{companyId}
            const response = await apiClient.get('/Companies/my-company', {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            const fetchedCompany = response.data;
            setCompanyData({
                name: fetchedCompany.name || '',
                email: fetchedCompany.email || '',
                phone_Number: fetchedCompany.phone_Number || '',
                address: fetchedCompany.address || '',
                industry: fetchedCompany.industry || '',
                numer_Biznesit: fetchedCompany.numer_Biznesit || '' // Populate for display
            });
            setOriginalCompanyData(fetchedCompany); // Store the original fetched data
            setCompanyId(fetchedCompany.companyId); // Make sure your /my-company returns companyId
        } catch (err) {
            console.error("Error fetching company details:", err.response || err);
            let errMsg = "Could not load company details.";
            if (err.response?.status === 404) {
                errMsg = "No company profile found to complete. Please contact support if this is an error.";
            } else if (err.response?.status === 401 || err.response?.status === 403) {
                errMsg = "You are not authorized to view or edit these company details.";
            } else if (err.response?.data?.message) {
                errMsg = err.response.data.message;
            } else if (typeof err.response?.data === 'string') {
                errMsg = err.response.data;
            }
            setError(errMsg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!token) {
            setError("Not authenticated. Please log in.");
            setIsLoading(false);
            return;
        }
        // If your /my-company endpoint correctly identifies the company from the token,
        // you don't strictly need to decode companyId here for *fetching*.
        // However, you WILL need companyId for the PUT request.
        // Let's assume /my-company gives us all we need including companyId.
        fetchCompanyDetails(null, token); // Pass null for companyId if /my-company doesn't need it in URL
    }, [token, fetchCompanyDetails]);


    const handleChange = (e) => {
        setCompanyData({ ...companyData, [e.target.name]: e.target.value });
        // Clear success message on change, so user knows they need to save again
        if (success) setSuccess(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!companyId) {
            setError("Company ID is missing. Cannot update profile.");
            return;
        }
        setIsSubmitting(true);
        setError(null);
        setSuccess(null);

        const payload = {
            name: companyData.name,
            email: companyData.email,
            phone_Number: companyData.phone_Number,
            address: companyData.address,
            industry: companyData.industry,
            // numer_Biznesit is generally not part of an update DTO for company profile
        };

        try {
            // Use the PUT /api/Companies/{companyId} endpoint
            const response = await apiClient.put(`/Companies/${companyId}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuccess(response.data.message || "Company profile updated successfully!");
            // Update originalCompanyData to reflect saved changes
            setOriginalCompanyData({...originalCompanyData, ...payload, companyId: companyId }); // Update local "original" state
            // Optionally, refetch to ensure data consistency if backend modifies data upon save
            // fetchCompanyDetails(companyId, token);
        } catch (err) {
            console.error("Error updating company profile:", err.response || err);
            if (err.response && err.response.data) {
                const errorData = err.response.data;
                if (errorData.errors) {
                    const messages = Object.values(errorData.errors).flat().map(msg => typeof msg === 'object' ? msg.description : msg);
                    setError(messages.join(' '));
                } else if (errorData.message) {
                    setError(errorData.message);
                } else if (typeof errorData === 'string') {
                    setError(errorData);
                } else {
                    setError("An unknown error occurred during update.");
                }
            } else {
                setError("An error occurred while updating. Please try again.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleReset = () => {
        if (originalCompanyData) {
            setCompanyData({
                name: originalCompanyData.name || '',
                email: originalCompanyData.email || '',
                phone_Number: originalCompanyData.phone_Number || '',
                address: originalCompanyData.address || '',
                industry: originalCompanyData.industry || '',
                numer_Biznesit: originalCompanyData.numer_Biznesit || ''
            });
            setError(null);
            setSuccess(null);
        }
    };


    if (isLoading) {
        return (
            <div className="container mt-4 text-center">
                <Spinner animation="border" />
                <p>Loading company details...</p>
            </div>
        );
    }

    return (
        <React.Fragment>
            {/* <Breadcrumb />  // If you use a breadcrumb component here */}
            <div className="container mt-4"> {/* Or your main content wrapper class */}
                <Row className="justify-content-center">
                    <Col md={8} lg={6}> {/* Adjust column size as needed */}
                        <Card>
                            <Card.Header>
                                <Card.Title as="h2">Company Profile</Card.Title>
                                <Card.Subtitle className="mb-2 text-muted">
                                    Update your company's information.
                                </Card.Subtitle>
                            </Card.Header>
                            <Card.Body>
                                {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
                                {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}

                                {!companyId && !isLoading && !error && ( // If loading is done, no error, but no companyId (likely from fetch error)
                                     <Alert variant="warning">Could not load company information to edit.</Alert>
                                )}

                                {companyId && ( // Only show form if companyId is available
                                    <Form onSubmit={handleSubmit}>
                                        <Form.Group className="mb-3" controlId="formCompanyName">
                                            <Form.Label>Company Name</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="name"
                                                value={companyData.name}
                                                onChange={handleChange}
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </Form.Group>

                                        <Form.Group className="mb-3" controlId="formCompanyEmail">
                                            <Form.Label>Company Contact Email</Form.Label>
                                            <Form.Control
                                                type="email"
                                                name="email"
                                                value={companyData.email}
                                                onChange={handleChange}
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </Form.Group>

                                        <Form.Group className="mb-3" controlId="formCompanyPhone">
                                            <Form.Label>Phone Number</Form.Label>
                                            <Form.Control
                                                type="tel"
                                                name="phone_Number"
                                                placeholder="e.g., +1-555-123-4567"
                                                value={companyData.phone_Number}
                                                onChange={handleChange}
                                                disabled={isSubmitting}
                                            />
                                        </Form.Group>

                                        <Form.Group className="mb-3" controlId="formCompanyAddress">
                                            <Form.Label>Address</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="address"
                                                placeholder="e.g., 123 Main St, Anytown, USA"
                                                value={companyData.address}
                                                onChange={handleChange}
                                                disabled={isSubmitting}
                                            />
                                        </Form.Group>

                                        <Form.Group className="mb-3" controlId="formCompanyIndustry">
                                            <Form.Label>Industry</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="industry"
                                                placeholder="e.g., Technology, Retail, Healthcare"
                                                value={companyData.industry}
                                                onChange={handleChange}
                                                disabled={isSubmitting}
                                            />
                                        </Form.Group>

                                        <Form.Group className="mb-3" controlId="formCompanyBusinessNumber">
                                            <Form.Label>Business Number</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="numer_Biznesit"
                                                value={companyData.numer_Biznesit}
                                                readOnly // Business number is usually not editable here
                                                disabled 
                                            />
                                        </Form.Group>
                                        
                                        <div className="d-flex justify-content-end">
                                            <Button variant="outline-secondary" onClick={handleReset} disabled={isSubmitting} className="me-2">
                                                Reset Changes
                                            </Button>
                                            <Button variant="primary" type="submit" disabled={isSubmitting}>
                                                {isSubmitting ? <><Spinner as="span" animation="border" size="sm" /> Saving...</> : 'Save Changes'}
                                            </Button>
                                        </div>
                                    </Form>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </div>
        </React.Fragment>
    );
}

export default CompanyDetails;