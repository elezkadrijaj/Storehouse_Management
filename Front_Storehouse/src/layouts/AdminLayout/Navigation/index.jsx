import React, { useContext, useState, useEffect } from 'react';

import { ConfigContext } from '../../../contexts/ConfigContext';
import useWindowSize from '../../../hooks/useWindowSize';

import NavLogo from './NavLogo';
import NavContent from './NavContent';
import navigation from '../../../menu-items'; 

import filterMenuItemsByRole from '../../../utils/menuFilter';

const SESSION_STORAGE_KEYS = {
  USER_ROLE: 'userRole'
};

const Navigation = () => {
  const configContext = useContext(ConfigContext);
  const { collapseMenu } = configContext.state;
  const windowSize = useWindowSize();

  const [accessibleNavItems, setAccessibleNavItems] = useState([]);

  useEffect(() => {
    const userRole = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ROLE);

    const filteredItems = filterMenuItemsByRole(navigation.items, userRole);

    setAccessibleNavItems(filteredItems);
  }, []);

  let navClass = ['pcoded-navbar'];

  if (windowSize.width < 992 && collapseMenu) {
    navClass = [...navClass, 'mob-open'];
  } else if (collapseMenu) {
    navClass = [...navClass, 'navbar-collapsed'];
  }

  let navBarClass = ['navbar-wrapper'];

  let navContent = (
    <div className={navBarClass.join(' ')}>
      <NavLogo />
      <NavContent navigation={accessibleNavItems} />
    </div>
  );

  if (windowSize.width < 992) {
    navContent = (
      <div className="navbar-wrapper">
        <NavLogo />
        <NavContent navigation={accessibleNavItems} />
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