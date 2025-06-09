/**
 * Recursively filters navigation menu items based on a user's role.
 * This function ensures that if a collapsible menu becomes empty after its
 * children are filtered, the parent menu is also removed.
 *
 * @param {Array} items 
 * @param {String} userRole 
 * @returns {Array}
 */
const filterMenuItemsByRole = (items, userRole) => {

  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map(item => {
      if (item.children) {
        const filteredChildren = filterMenuItemsByRole(item.children, userRole);
        return { ...item, children: filteredChildren };
      }
      return item;
    })
    .filter(item => {

      if (item.id === 'mystorehouse' && userRole === 'CompanyManager') {
        return false; 
      }

      if (item.type === 'collapse' && (!item.children || item.children.length === 0)) {
        return false;
      }

      return true;
    });
};

export default filterMenuItemsByRole;