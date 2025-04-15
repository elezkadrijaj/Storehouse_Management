import React, { Suspense, Fragment, lazy } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'; // Import useSearchParams
import Loader from './components/Loader/Loader';
import AdminLayout from './layouts/AdminLayout';
import { BASE_URL } from './config/constant';

export const renderRoutes = (routes = []) => (
  <Suspense fallback={<Loader />}>
    <Routes>
      {routes.map((route, i) => {
        const Guard = route.guard || Fragment;
        const Layout = route.layout || Fragment;
        const Element = route.element;

        return (
          <Route
            key={i}
            path={route.path}
            element={
              <Guard>
                <Layout>
                  {route.routes ? (
                    renderRoutes(route.routes)
                  ) : (
                    <Element /> // Render the element as a component, not a function call
                  )}
                </Layout>
              </Guard>
            }
          />
        );
      })}
    </Routes>
  </Suspense>
);

const routes = [
  {
    exact: 'true',
    path: '/login',
    element: lazy(() => import('./views/auth/signin/SignIn1'))
  },
  {
    exact: 'true',
    path: '/auth/signin-1',
    element: lazy(() => import('./views/auth/signin/SignIn1'))
  },
  {
    exact: 'true',
    path: '/auth/signup-1',
    element: lazy(() => import('./views/auth/signup/SignUp1'))
  },
  {
    path: '*',
    layout: AdminLayout,
    routes: [
      {
        exact: 'true',
        path: '/app/dashboard/default',
        element: lazy(() => import('./views/dashboard'))
      },
      {
        exact: 'true',
        path: '/app/company',
        element: lazy(() => import('./views/company'))
      },
      {
        exact: 'true',
        path: '/app/storehouse',
        element: lazy(() => import('./views/storehouse'))
      },
      {
        exact: 'true',
        path: '/app/sections',
        element: lazy(() => import('./views/sections')) 
      },
      {
        exact: 'true',
        path: '/app/mystorehouse',
        element: lazy(() => import('./views/myStorehouse')) 
      },
      {
        exact: 'true',
        path: '/app/allworkers',
        element: lazy(() => import('./views/allworkers')) 
      },
      {
        exact: 'true',
        path: '/app/category',
        element: lazy(() => import('./views/category')) 
      },
      {
        exact: 'true',
        path: '/app/product',
        element: lazy(() => import('./views/product')) 
      },
      {
        exact: 'true',
        path: '/app/supplier',
        element: lazy(() => import('./views/supplier')) 
      },
      {
        exact: 'true',
        path: '/app/storehouseworkers',
        element: lazy(() => import('./views/storehouseWorkers')) 
      },
      {
        exact: 'true',
        path: '/app/userprofile',
        element: lazy(() => import('./views/userprofile')) 
      },
      {
        exact: 'true',
        path: '/basic/button',
        element: lazy(() => import('./views/ui-elements/basic/BasicButton'))
      },
      {
        exact: 'true',
        path: '/basic/badges',
        element: lazy(() => import('./views/ui-elements/basic/BasicBadges'))
      },
      {
        exact: 'true',
        path: '/basic/breadcrumb-paging',
        element: lazy(() => import('./views/ui-elements/basic/BasicBreadcrumb'))
      },
      {
        exact: 'true',
        path: '/basic/collapse',
        element: lazy(() => import('./views/ui-elements/basic/BasicCollapse'))
      },
      {
        exact: 'true',
        path: '/basic/tabs-pills',
        element: lazy(() => import('./views/ui-elements/basic/BasicTabsPills'))
      },
      {
        exact: 'true',
        path: '/basic/typography',
        element: lazy(() => import('./views/ui-elements/basic/BasicTypography'))
      },
      {
        exact: 'true',
        path: '/forms/form-basic',
        element: lazy(() => import('./views/forms/FormsElements'))
      },
      {
        exact: 'true',
        path: '/tables/bootstrap',
        element: lazy(() => import('./views/tables/StorehouseTable'))
      },
      {
        exact: 'true',
        path: '/charts/nvd3',
        element: lazy(() => import('./views/charts/nvd3-chart'))
      },
      {
        exact: 'true',
        path: '/sample-page',
        element: lazy(() => import('./views/extra/SamplePage'))
      },
      {
        path: '*',
        exact: 'true',
        element: () => <Navigate to={BASE_URL} />
      }
    ]
  }
];

export default routes;