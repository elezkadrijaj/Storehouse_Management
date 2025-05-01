import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole', 
    USER_NAME: 'userName', 
};


function CompanyDetails() {
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCompanyDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

                if (!token) {
                    setError('No token found. Please log in.');
                    setLoading(false);
                    return;
                }

                const config = {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                };

                const response = await axios.get('https://localhost:7204/api/Companies/my-company', config);
                setCompany(response.data);
                setLoading(false);
            } catch (err) {
                setError(err.response?.data || err.message || 'An unexpected error occurred.');
                setLoading(false);
            }
        };

        fetchCompanyDetails();
    }, []);

    if (loading) {
        return <div>Loading company details...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    if (!company) {
        return <div>No company details found.</div>;
    }

    return (
        <div>
            <h2>Company Details</h2>
            <p>Name: {company.name || 'N/A'}</p>
            <p>Email: {company.email || 'N/A'}</p>
            <p>Address: {company.address || 'N/A'}</p>
            <p>Business Number: {company.numer_Biznesit || 'N/A'}</p>
        </div>
    );
}

export default CompanyDetails;