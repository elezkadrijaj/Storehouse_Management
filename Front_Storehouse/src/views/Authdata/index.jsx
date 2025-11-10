import { useState, useEffect } from 'react';

export const useAuth = () => {
    const [authState, setAuthState] = useState({
        isAuthenticated: false,
        roles: []
    });

    useEffect(() => {
        const checkAuthStatus = () => {
            const role = sessionStorage.getItem('userRole');
            
            if (role) {
                setAuthState({
                    isAuthenticated: true,
                    roles: [role] 
                });
            } else {
                setAuthState({
                    isAuthenticated: false,
                    roles: []
                });
            }
        };

        checkAuthStatus();
        
        window.addEventListener('storage', checkAuthStatus);
        
        return () => {
            window.removeEventListener('storage', checkAuthStatus);
        };
    }, []); 
    
    return authState;
};