import Cookies from 'js-cookie';
import axios from 'axios';

const cookieUtils = {
  setUserRoleInCookies: (role) => {
    Cookies.set('userRole', role, { expires: 1 });
  },
  setUserIdInCookies: (userId) => {
    Cookies.set('userId', userId, { expires: 1 });
  },
  setNameInCookies: (name) => {
    Cookies.set('name', name, { expires: 1 });
  },
  setTokenCookies: (token) => {
    Cookies.set('token', token, { expires: 1 });
  },
  setCompanyIdInCookies: (companyId) => {
    Cookies.set('companyId', companyId, { expires: 1 }); // Set cookie expiration
  },

  getUserIdFromCookies: () => {
    return Cookies.get('userId');
  },
  getUserRoleFromCookies: () => {
    return Cookies.get('userRole');
  },
  getNameFromCookies: () => {
    return Cookies.get('name');
  },
  getTokenFromCookies: () => {
    return Cookies.get('token');
  },
  getCompanyIdFromCookies: () => { // Added getter for consistency
    return Cookies.get('companyId');
  },

  getCookie: (name) => {
    return Cookies.get(name);
  },

  setRefreshToken: (refreshToken) => {
    Cookies.set('refreshToken', refreshToken, { expires: 1 }); 
  },

  refreshRefreshToken: async () => {
    try {
      const response = await axios.post('https://localhost:7204/api/Account/login', {
        refreshToken: Cookies.get('refreshToken')
      });

      const newRefreshToken = response.data.refreshToken;
      Cookies.set('refreshToken', newRefreshToken, { expires: 7 });
      console.log('Refresh token executed.');
    } catch (error) {
      console.error('Error refreshing token:', error);
    }
  },

  startRefreshingToken: () => {
    setInterval(cookieUtils.refreshRefreshToken, 5 * 60 * 1000); 
  },

  clearUserRole: () => {
    Cookies.remove('userRole');
    Cookies.remove('userId');
    Cookies.remove('name');
    Cookies.remove('token');
    Cookies.remove('refreshToken');
    Cookies.remove('companyId');
  }
};

export default cookieUtils;