import { useState, useEffect } from 'react';

const SESSION_STORAGE_KEYS = { TOKEN: 'authToken' };

const decodeToken = (token) => {
    try {
        const payload = token.split('.')[1];
        const decodedPayload = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decodedPayload);
    } catch (e) {
        console.error("Failed to decode token:", e);
        return null;
    }
};

export const useAuth = () => {
    const [authData, setAuthData] = useState({ roles: [], isAuthenticated: false });

    useEffect(() => {
        const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
        if (token) {
            const decoded = decodeToken(token);
            if (decoded) {
                const roleClaimKey = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
                let userRoles = decoded[roleClaimKey] || [];
                
                if (!Array.isArray(userRoles)) {
                    userRoles = [userRoles];
                }

                setAuthData({ roles: userRoles, isAuthenticated: true });
            }
        }
    }, []);

    return authData;
};