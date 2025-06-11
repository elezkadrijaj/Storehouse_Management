import React, { useContext, useState, useEffect } from 'react';

import { ConfigContext } from '../../../contexts/ConfigContext';
import useWindowSize from '../../../hooks/useWindowSize';
import { useAuth } from '../../../views/Authdata'; // You need to import your auth hook
import originalMenuItems from '../../../menu-items'; // Import the master menu list

import NavLogo from './NavLogo';
import NavContent from './NavContent';
import { getFilteredMenuItems } from '../../../views/utils/index'; // Import your filter function

const Navigation = () => {
  const configContext = useContext(ConfigContext);
  const { collapseMenu } = configContext.state;
  const windowSize = useWindowSize();

  // 1. Get authentication state and roles from your hook
  const { isAuthenticated, roles } = useAuth();

  // 2. Create a state to hold the menu items that will be displayed
  const [displayMenu, setDisplayMenu] = useState({ items: [] });

  // 3. Use an effect to decide which menu to show
  useEffect(() => {
    // If the user IS logged in
    if (isAuthenticated) {
      // Use your existing filter function to get the role-based menu
      const filteredMenu = getFilteredMenuItems(originalMenuItems, roles || []);
      setDisplayMenu(filteredMenu);
    } 
    // If the user is NOT logged in
    else {
      // Create a simple menu with only Authentication links
      const loggedOutMenu = {
        items: [
          {
            id: 'authentication-group',
            title: 'Pages',
            type: 'group',
            icon: 'icon-navigation',
            children: [
              {
                id: 'login',
                title: 'Sign In',
                type: 'item',
                url: '/login', // Path to your login page
                icon: 'feather icon-log-in'
              },
              {
                id: 'register',
                title: 'Sign Up',
                type: 'item',
                url: '/auth/signup-1', // Path to your sign up page
                icon: 'feather icon-user-plus'
              }
            ]
          }
        ]
      };
      setDisplayMenu(loggedOutMenu);
    }
  }, [isAuthenticated, roles]); // This effect runs when the user logs in or out


  // --- The rest of your component's code remains the same ---
  // --- It will now use the dynamic 'displayMenu' state ---

  let navClass = ['pcoded-navbar'];

  if (windowSize.width < 992 && collapseMenu) {
    navClass = [...navClass, 'mob-open'];
  } else if (collapseMenu) {
    navClass = [...navClass, 'navbar-collapsed'];
  }

  let navBarClass = ['navbar-wrapper'];

  // 4. Use the 'displayMenu' state to render the navigation content
  let navContent = (
    <div className={navBarClass.join(' ')}>
      <NavLogo />
      <NavContent navigation={displayMenu.items} />
    </div>
  );
  if (windowSize.width < 992) {
    navContent = (
      <div className="navbar-wrapper">
        <NavLogo />
        <NavContent navigation={displayMenu.items} />
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