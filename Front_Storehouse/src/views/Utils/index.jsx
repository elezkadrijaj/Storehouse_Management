const roleBasedRules = {
  'CompanyManager': [
    'mystorehouse',
    'storehouseworkers'
  ],
  'StorehouseManager': [
    'storehouse',
    'roles',
    'company',
    'allworkers'
  ],
  'Worker': [
    'company',
    'storehouse',
    'allworkers',
    'roles',
    'storehouseworkers'
  ]
};

const filterChildren = (children, itemsToHide) => {
  return children.reduce((acc, item) => {
    if (itemsToHide.includes(item.id)) {
      return acc;
    }
    if (item.children) {
      const filteredGrandChildren = filterChildren(item.children, itemsToHide);
      if (filteredGrandChildren.length > 0) {
        acc.push({ ...item, children: filteredGrandChildren });
      }
    } else {
      acc.push(item);
    }
    return acc;
  }, []);
};

export const getFilteredMenuItems = (originalMenuItems, roles) => {
  const itemsToHideSet = new Set();
  roles.forEach(role => {
    if (roleBasedRules[role]) {
      roleBasedRules[role].forEach(itemId => {
        itemsToHideSet.add(itemId);
      });
    }
  });

  const itemsToHide = Array.from(itemsToHideSet);
  const newMenu = JSON.parse(JSON.stringify(originalMenuItems));

  newMenu.items = newMenu.items.map(group => {
    if (group.children) {
      group.children = filterChildren(group.children, itemsToHide);
    }
    return group;
  }).filter(group => 
    group.children && group.children.length > 0
  );

  return newMenu;
};