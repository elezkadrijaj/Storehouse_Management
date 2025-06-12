const menuItems = {
  items: [
    {
      id: 'navigation',
      title: 'Navigation',
      type: 'group',
      icon: 'icon-navigation',
      children: [
        {
          id: 'dashboard',
          title: 'Dashboard',
          type: 'item',
          icon: 'feather icon-home',
          url: '/app/dashboard/default'
        },
        {
          id: 'company',
          title: 'Company',
          type: 'item',
          icon: 'feather icon-briefcase',
          url: '/app/company'
        }
      ]
    },
    {
      id: 'ui-element',
      title: 'UI ELEMENT',
      type: 'group',
      icon: 'icon-ui',
      children: [
        {
          id: 'storehouse',
          title: 'Storehouse',
          type: 'item',
          icon: 'feather icon-briefcase',
          url: '/app/storehouse'
        },
        {
          id: 'mystorehouse',
          title: 'My Storehouse',
          type: 'item',
          icon: 'feather icon-briefcase',
          url: '/app/mystorehouse'
        },
        {
          id: 'allworkers',
          title: 'All Workers',
          type: 'item',
          icon: 'feather icon-briefcase',
          url: '/app/allworkers'
        },
        {
          id: 'roles',
          title: 'Roles',
          type: 'item',
          icon: 'feather icon-briefcase',
          url: '/app/roles'
        },
        {
          id: 'order',
          title: 'Order',
          type: 'item',
          icon: 'feather icon-briefcase',
          url: '/app/order'
        },
        {
          id: 'productmanagment',
          title: 'Product Managment',
          type: 'collapse',
          icon: 'feather icon-box',
          children: [
            {
              id: 'allproducts',
              title: 'All Products',
              type: 'item',
              url: '/app/allproducts'
            },
            {
              id: 'category',
              title: 'Category',
              type: 'item',
              url: '/app/category'
            },
            {
              id: 'suppier',
              title: 'Supplier',
              type: 'item',
              url: '/app/supplier'
            }
          ]
        },
        {
          id: 'component',
          title: 'Component',
          type: 'collapse',
          icon: 'feather icon-box',
          children: [
            {
              id: 'button',
              title: 'Button',
              type: 'item',
              url: '/basic/button'
            },
            {
              id: 'badges',
              title: 'Badges',
              type: 'item',
              url: '/basic/badges'
            },
            {
              id: 'breadcrumb',
              title: 'Breadcrumb & Pagination',
              type: 'item',
              url: '/basic/breadcrumb-paging'
            },
            {
              id: 'collapse',
              title: 'Collapse',
              type: 'item',
              url: '/basic/collapse'
            },
            {
              id: 'tabs-pills',
              title: 'Tabs & Pills',
              type: 'item',
              url: '/basic/tabs-pills'
            },
            {
              id: 'typography',
              title: 'Typography',
              type: 'item',
              url: '/basic/typography'
            }
          ]
        }
      ]
    },
    {
      id: 'ui-forms',
      title: 'FORMS & TABLES',
      type: 'group',
      icon: 'icon-group',
      children: [
        {
          id: 'forms',
          title: 'Form Elements',
          type: 'item',
          icon: 'feather icon-file-text',
          url: '/forms/form-basic'
        },
        {
          id: 'table',
          title: 'Table',
          type: 'item',
          icon: 'feather icon-server',
          url: '/tables/bootstrap'
        }
      ]
    },
    {
      id: 'chart-maps',
      title: 'Chart & Maps',
      type: 'group',
      icon: 'icon-charts',
      children: [
        {
          id: 'charts',
          title: 'Charts',
          type: 'item',
          icon: 'feather icon-pie-chart',
          url: '/charts/nvd3'
        },
      ]
    },
    {
      id: 'pages',
      title: 'Pages',
      type: 'group',
      icon: 'icon-pages',
      children: [
        {
          id: 'auth',
          title: 'Authentication',
          type: 'collapse',
          icon: 'feather icon-lock',
          badge: {
            title: 'New',
            type: 'label-danger'
          },
          children: [
            {
              id: 'signup-1',
              title: 'Sign up',
              type: 'item',
              url: '/auth/signup-1',
              target: true,
              breadcrumbs: false
            },
            {
              id: 'signin-1',
              title: 'Sign in',
              type: 'item',
              url: '/auth/signin-1',
              target: true,
              breadcrumbs: false
            },
            {
              id: 'register-worker',
              title: 'Register Worker',
              type: 'item',
              url: '/auth/register-worker', // This URL MUST match the path in your route
              target: false // Or you can remove this line entirely
            }
          ]
        }
      ]
    }
  ]
};

export default menuItems;
