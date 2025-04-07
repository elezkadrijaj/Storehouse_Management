import React, { useState, useEffect } from 'react';
import axios from 'axios';
import cookieUtils from 'views/auth/cookieUtils'; // Adjust path if needed
import { jwtDecode } from 'jwt-decode'; // <--- Import jwt-decode
import { Table, Alert, Spinner, Badge } from 'react-bootstrap'; // Using react-bootstrap
import 'bootstrap/dist/css/bootstrap.min.css';

// Define the expected shape of a worker (optional, but good for clarity)
// interface WorkerDto { ... }

function AllWorkers() {
    const [workers, setWorkers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [businessNumber, setBusinessNumber] = useState(null); // State to hold the extracted number
    const [isCompanyManager, setIsCompanyManager] = useState(false); // State for role check

    // --- Get token from cookies ---
    const token = cookieUtils.getTokenFromCookies();

    useEffect(() => {
        let decodedToken = null;
        let extractedBusinessNumber = null;
        let extractedRole = null;

        // --- Decode Token and Extract Info ---
        if (token) {
            try {
                decodedToken = jwtDecode(token);
                // console.log("Decoded Token:", decodedToken); // Debug log

                // --- Extract Business Number (Use exact claim name from your token) ---
                extractedBusinessNumber = decodedToken.CompanyBusinessNumber;
                setBusinessNumber(extractedBusinessNumber); // Update state

                // --- Extract Role (Use exact claim name from your token) ---
                // Note: Claim names with special chars need bracket notation
                const roleClaimName = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
                extractedRole = decodedToken[roleClaimName];
                setIsCompanyManager(extractedRole?.toLowerCase() === 'companymanager'); // Update state

            } catch (e) {
                console.error("Error decoding token:", e);
                setError("Invalid token found. Please log in again.");
                setIsLoading(false);
                return; // Stop if token is invalid
            }
        } else {
            setError("Authentication Error: No token found. Please log in.");
            setIsLoading(false);
            return; // Stop if no token
        }
        // --- End Token Decoding ---


        // --- Pre-fetch Checks (using extracted info) ---
        if (!extractedRole || extractedRole.toLowerCase() !== 'companymanager') {
            setError("Access Denied: You must be a Company Manager to view this page.");
            setIsLoading(false);
            return;
        }
        if (!extractedBusinessNumber) {
            setError("Configuration Error: Company Business Number not found in token.");
            setIsLoading(false);
            return;
        }
        // --- End Pre-fetch Checks ---


        const fetchWorkers = async () => {
            setIsLoading(true);
            setError(null);
            setWorkers([]);

            const API_URL = `https://localhost:7204/api/Account/all-workers/${encodeURIComponent(extractedBusinessNumber)}`;
            // console.log("Fetching workers from:", API_URL);

            const config = {
                headers: {
                    Authorization: `Bearer ${token}`, // Still need the original token string for auth
                    'Accept': 'application/json'
                }
            };

            try {
                const response = await axios.get(API_URL, config);
                setWorkers(response.data);

            } catch (err) {
                console.error("Error fetching workers:", err);
                let errorMessage = "An unexpected error occurred while fetching workers.";
                 if (err.response) {
                    if (err.response.status === 404) {
                        errorMessage = `No workers found for business number: ${extractedBusinessNumber}.`;
                        setWorkers([]);
                    } else if (err.response.status === 401 || err.response.status === 403) {
                         errorMessage = "Authorization failed. Please check your permissions or log in again.";
                    } else if (err.response.data) {
                         errorMessage = err.response.data.message || err.response.data.title || JSON.stringify(err.response.data);
                    } else {
                        errorMessage = `Error: ${err.response.status} ${err.response.statusText}`;
                    }
                } else if (err.request) {
                    errorMessage = "Network Error: Could not connect to the API server.";
                } else {
                    errorMessage = err.message;
                }
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        // Only fetch if checks passed
        fetchWorkers();

        // Dependency array: re-run effect if the token changes
    }, [token]);


    // --- Render Logic ---

    // Display errors set during initial checks or fetching
    if (!isLoading && error) {
        return <Alert variant="danger" className="mt-4 container">{error}</Alert>;
    }
    // Display loading state
    if (isLoading) {
         return (
            <div className="container mt-4 text-center">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
                <p>Loading workers...</p>
            </div>
         );
    }

    // Main content render (only if loading is done and no error)
    // Note: The isCompanyManager check is implicitly handled by the error setting in useEffect
    return (
        <div className="container mt-4">
            <h1>Company Workers</h1>
            <p>Showing workers associated with business number: {businessNumber || "N/A"}</p>

             {workers.length > 0 ? (
                <Table striped bordered hover responsive size="sm">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Company Name</th>
                            <th>StoreHouse Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        {workers.map((worker, index) => (
                            <tr key={worker.id}>
                                <td>{index + 1}</td>
                                <td>{worker.username}</td>
                                <td>{worker.email}</td>
                                <td>
                                    <Badge bg={worker.emailConfirmed ? 'success' : 'warning'}>
                                        {worker.emailConfirmed ? 'Confirmed' : 'Pending'}
                                    </Badge>
                                </td>
                                <td>{worker.companyName }</td>
                                <td>{worker.storeHouseName || 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            ) : (
                 <Alert variant="info">No workers found for this business number.</Alert>
            )}
        </div>
    );
}

export default AllWorkers;