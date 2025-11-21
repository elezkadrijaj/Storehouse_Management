import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Alert, Spinner, Card, Row, Col } from 'react-bootstrap';
import apiClient from '../../appService';

// NOTE: jwt-decode and axios imports are no longer needed here.

const SESSION_STORAGE_KEYS = {
    // REMOVED: TOKEN is no longer stored on the client.
    USER_ROLE: 'userRole',
};

function CompanyDetails() {
    // All state hooks remain the same
    const [companyData, setCompanyData] = useState({
        name: '', email: '', phone_Number: '',
        address: '', industry: '', numer_Biznesit: ''
    });
    const [originalCompanyData, setOriginalCompanyData] = useState(null);
    const [companyId, setCompanyId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    
    // REFACTORED: Simplified fetchCompanyDetails
    const fetchCompanyDetails = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // No auth config needed. The browser sends the cookie automatically.
            const response = await apiClient.get('/Companies/my-company');
            
            const fetchedCompany = response.data;
            setCompanyData({
                name: fetchedCompany.name || '',
                email: fetchedCompany.email || '',
                phone_Number: fetchedCompany.phone_Number || '',
                address: fetchedCompany.address || '',
                industry: fetchedCompany.industry || '',
                numer_Biznesit: fetchedCompany.numer_Biznesit || ''
            });
            setOriginalCompanyData(fetchedCompany);
            setCompanyId(fetchedCompany.companyId);
        } catch (err) {
            console.error("Error fetching company details:", err.response || err);
            const errMsg = err.response?.data?.message || "Could not load company details.";
            setError(errMsg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // We check for a role to see if the user is logged in.
        const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);
        if (!userRole) {
            setError("Not authenticated. Please log in.");
            setIsLoading(false);
            return;
        }
        fetchCompanyDetails();
    }, [fetchCompanyDetails]);


    const handleChange = (e) => {
        setCompanyData({ ...companyData, [e.target.name]: e.target.value });
        if (success) setSuccess(null);
    };

    // REFACTORED: Simplified handleSubmit
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
        };

        try {
            // No auth config needed for the PUT request.
            const response = await apiClient.put(`/Companies/${companyId}`, payload);
            setSuccess(response.data.message || "Company profile updated successfully!");
            setOriginalCompanyData({ ...originalCompanyData, ...payload, companyId });
        } catch (err) {
            console.error("Error updating company profile:", err.response || err);
            const errorData = err.response?.data;
            let errorMessage = "An unknown error occurred during update.";
            if (errorData) {
                if (errorData.errors) {
                    errorMessage = Object.values(errorData.errors).flat().join(' ');
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (typeof errorData === 'string') {
                    errorMessage = errorData;
                }
            }
            setError(errorMessage);
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

    // --- The entire return JSX remains exactly the same ---
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
            <div className="container mt-4">
                <Row className="justify-content-center">
                    <Col md={8} lg={6}>
                        <Card>
                            <Card.Header>
                                <Card.Title as="h2">Company Profile</Card.Title>
                                <Card.Subtitle className="mb-2 text-muted">Update your company's information.</Card.Subtitle>
                            </Card.Header>
                            <Card.Body>
                                {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
                                {success && <Alert variant="success" onClose={() => setSuccess(null)} dismissible>{success}</Alert>}

                                {!companyId && !isLoading && !error && (
                                     <Alert variant="warning">Could not load company information to edit.</Alert>
                                )}

                                {companyId && (
                                    <Form onSubmit={handleSubmit}>
                                        <Form.Group className="mb-3" controlId="formCompanyName">
                                            <Form.Label>Company Name</Form.Label>
                                            <Form.Control type="text" name="name" value={companyData.name} onChange={handleChange} required disabled={isSubmitting} />
                                        </Form.Group>
                                        <Form.Group className="mb-3" controlId="formCompanyEmail">
                                            <Form.Label>Company Contact Email</Form.Label>
                                            <Form.Control type="email" name="email" value={companyData.email} onChange={handleChange} required disabled={isSubmitting} />
                                        </Form.Group>
                                        <Form.Group className="mb-3" controlId="formCompanyPhone">
                                            <Form.Label>Phone Number</Form.Label>
                                            <Form.Control type="tel" name="phone_Number" placeholder="e.g., +1-555-123-4567" value={companyData.phone_Number} onChange={handleChange} disabled={isSubmitting} />
                                        </Form.Group>
                                        <Form.Group className="mb-3" controlId="formCompanyAddress">
                                            <Form.Label>Address</Form.Label>
                                            <Form.Control type="text" name="address" placeholder="e.g., 123 Main St, Anytown, USA" value={companyData.address} onChange={handleChange} disabled={isSubmitting} />
                                        </Form.Group>
                                        <Form.Group className="mb-3" controlId="formCompanyIndustry">
                                            <Form.Label>Industry</Form.Label>
                                            <Form.Control type="text" name="industry" placeholder="e.g., Technology, Retail, Healthcare" value={companyData.industry} onChange={handleChange} disabled={isSubmitting} />
                                        </Form.Group>
                                        <Form.Group className="mb-3" controlId="formCompanyBusinessNumber">
                                            <Form.Label>Business Number</Form.Label>
                                            <Form.Control type="text" name="numer_Biznesit" value={companyData.numer_Biznesit} readOnly disabled />
                                        </Form.Group>
                                        <div className="d-flex justify-content-end">
                                            <Button variant="outline-secondary" onClick={handleReset} disabled={isSubmitting} className="me-2">Reset Changes</Button>
                                            <Button variant="primary" type="submit" disabled={isSubmitting}>{isSubmitting ? <><Spinner as="span" animation="border" size="sm" /> Saving...</> : 'Save Changes'}</Button>
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