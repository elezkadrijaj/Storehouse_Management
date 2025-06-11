const itemsToHideForManager = [
    'mystorehouse',
    'storehouse',
    'allworkers',
    'storehouseworkers'
];

/**
 * 
 * @param {Array} items 
 * @param {Array} roles
 * @returns {Array}
 */
const filterItems = (items, roles) => {

    if (!roles.includes('CompanyManager')) {
        return items;
    }

    return items.reduce((acc, item) => {
        if (itemsToHideForManager.includes(item.id)) {
            return acc; 
        }

        if (item.children) {
            const filteredChildren = filterItems(item.children, roles);
            if (filteredChildren.length > 0) {
                acc.push({ ...item, children: filteredChildren });
            }
        } else {
            acc.push(item);
        }
        
        return acc;
    }, []);
};


/**
 * 
 * @param {Object} originalMenuItems 
 * @param {Array} roles 
 * @returns {Object}
 */
export const getFilteredMenuItems = (originalMenuItems, roles) => {
    const menuItems = JSON.parse(JSON.stringify(originalMenuItems));

    menuItems.items = filterItems(menuItems.items, roles);

    return menuItems;
};