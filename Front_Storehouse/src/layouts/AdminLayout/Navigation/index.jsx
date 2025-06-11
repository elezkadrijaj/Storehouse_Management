import React, { useContext, useState, useEffect } from 'react';
// Link is not needed here if your NavContent component handles it
// import { Link } from 'react-router-dom';

import { ConfigContext } from '../../../contexts/ConfigContext';
import useWindowSize from '../../../hooks/useWindowSize';
import NavLogo from './NavLogo';
import NavContent from './NavContent';
import originalMenuItems from '../../../menu-items';
import { useAuth } from 'views/Authdata';
import { getFilteredMenuItems } from '../../../views/Utils/index';

const Navigation = () => {
  const configContext = useContext(ConfigContext);
  const { collapseMenu } = configContext.state;
  const windowSize = useWindowSize();

  const { roles, isAuthenticated } = useAuth();
  const [accessibleNavigation, setAccessibleNavigation] = useState({ items: [] });

  useEffect(() => {
    // If the user IS logged in, show the filtered menu based on their role
    if (isAuthenticated) {
      const userRoles = roles || [];
      const filteredMenu = getFilteredMenuItems(originalMenuItems, userRoles);
      setAccessibleNavigation(filteredMenu);
    } 
    // If the user is NOT logged in, show only the Authentication menu
    else {
      // Create an "Authentication" menu group for logged-out users
      const authMenuItems = {
        items: [
          {
            id: 'authentication',
            title: 'Authentication',
            type: 'group',
            icon: 'icon-navigation', // This is a placeholder for a group's main icon
            children: [
              {
                id: 'login',
                title: 'Sign In',
                type: 'item',
                url: '/login', // Correct path to your login page
                icon: 'feather icon-log-in'
              },
              {
                id: 'register',
                title: 'Sign Up',
                type: 'item',
                url: '/auth/signup-1', // Correct path to your signup page
                icon: 'feather icon-user-plus'
              }
            ]
          }
        ]
      };
      setAccessibleNavigation(authMenuItems);
    }
  }, [isAuthenticated, roles]); // This effect runs whenever authentication status changes

  // The rest of your component remains exactly the same
  let navClass = ['pcoded-navbar'];
  navClass = [...navClass];
  if (windowSize.width < 992 && collapseMenu) {
    navClass = [...navClass, 'mob-open'];
  } else if (collapseMenu) {
    navClass = [...navClass, 'navbar-collapsed'];
  }
  let navBarClass = ['navbar-wrapper'];

  let navContent = (
    <div className={navBarClass.join(' ')}>
      <NavLogo />
      <NavContent navigation={accessibleNavigation.items} />
    </div>
  );
  if (windowSize.width < 992) {
    navContent = (
      <div className="navbar-wrapper">
        <NavLogo />
        <NavContent navigation={accessibleNavigation.items} />
      </div>
    );
  }
  return (
    <React.Fragment>
      <nav className={navClass.join(' ')}>{navContent}</nav>
    </React.Fragment>
  );
};

export default Navigation;