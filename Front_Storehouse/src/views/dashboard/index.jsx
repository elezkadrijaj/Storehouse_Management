import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { Link } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import Button from 'react-bootstrap/Button';
import { Line } from 'react-chartjs-2';
import { jwtDecode } from 'jwt-decode';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LogarithmicScale
} from 'chart.js';

import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import { ArrowClockwise } from 'react-bootstrap-icons';
import 'react-toastify/dist/ReactToastify.css';
import apiClient from '../../appService';


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LogarithmicScale
);

// ================== START: ADDED HELPER FUNCTIONS (from OrderList.jsx) ==================
const API_BASE_URL = 'https://localhost:7204/api';

const getAuthConfig = () => {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
        toast.error('Authentication token missing. Please log in.');
        return null;
    }
    return { 
        headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        } 
    };
};

const getStatusBadgeVariant = (status) => {
    switch (status?.toLowerCase()) {
      case 'created': return "secondary";
      case 'billed': return "info";
      case 'readyfordelivery': return "primary";
      case 'intransit': return "warning";
      case 'completed': return "success";
      case 'returned': return "danger";
      case 'canceled': return "dark";
      default: return "light";
    }
};
// ================== END: ADDED HELPER FUNCTIONS ==================


// --- No changes to these existing components ---
const WelcomeScreen = () => { /* ... existing code ... */ 
  return (
    <Container fluid className="py-5 px-lg-4 d-flex align-items-center justify-content-center" style={{ backgroundColor: '#f8f9fa', minHeight: 'calc(100vh - 56px)' }}>
      <Row className="justify-content-center text-center">
        <Col md={8} lg={6}>
          <Card className="shadow-sm border-0 p-4 p-md-5">
            <Card.Body>
              <h1 className="display-4 fw-bold mb-3">Welcome!</h1>
              <p className="lead mb-4">
                This is your central hub for managing sales, orders, and company data efficiently.
                Please log in to access your personalized dashboard and tools.
              </p>
              <Button as={Link} to="/auth/signin-1" variant="primary" size="lg" className="mt-4">
                Proceed to Login
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};
const getTrendIndicator = (trend) => { /* ... existing code ... */ 
  if (trend === 'up') return { icon: '↑', colorClass: 'text-success' };
  if (trend === 'down') return { icon: '↓', colorClass: 'text-danger' };
  return { icon: '–', colorClass: 'text-muted' };
};
const formatCurrency = (amount) => { /* ... existing code ... */ 
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
};
const SalesCard = ({ title, data }) => { /* ... existing code ... */ 
  const trendIndicator = getTrendIndicator(data.trend);
  const percentageChangeDisplay = (typeof data.percentageChange === 'number' && !isNaN(data.percentageChange))
    ? `${data.percentageChange >= 0 ? '+' : ''}${data.percentageChange.toFixed(1)}%`
    : 'N/A';
  const progressBarValue = (typeof data.progressBarPercentage === 'number' && !isNaN(data.progressBarPercentage))
    ? Math.round(data.progressBarPercentage)
    : 0;

  let progressBarVariant;
  if (title === "Daily Sales") progressBarVariant = "info";
  else if (title === "Monthly Sales") progressBarVariant = "secondary";
  else progressBarVariant = "primary";

  return (
    <Col md={4} className="mb-4">
      <Card className="h-100 shadow-sm">
        <Card.Body className="d-flex flex-column">
          <Card.Title as="h5" className="mb-3">{title}</Card.Title>
          <div className="d-flex align-items-center mb-2"><span className={`${trendIndicator.colorClass} fs-4 me-2`}>{trendIndicator.icon}</span><span className="h3 mb-0 fw-bold">{formatCurrency(data.amount)}</span></div>
          <div className="mb-3"><span className={`${trendIndicator.colorClass} small`}>{percentageChangeDisplay}</span></div>
          <ProgressBar now={progressBarValue} variant={progressBarVariant} style={{ height: '8px' }} className="mb-1" />
          <p className="text-end small text-muted mt-0 mb-0">{progressBarValue}%</p>
        </Card.Body>
      </Card>
    </Col>
  );
};
const SalesGraph = ({ graphData }) => { /* ... existing code ... */ 
  const nonZeroSales = graphData.filter(d => d.value > 0).map(d => d.value);
  let suggestedMin = 0.1;
  if (nonZeroSales.length > 0) {
    const minSale = Math.min(...nonZeroSales);
    suggestedMin = Math.max(0.01, Math.min(1, minSale / 10));
  }

  const dataForChart = {
    labels: graphData.map(d => {
      const date = new Date(d.label + 'T00:00:00Z');
      return `${date.toLocaleString('default', { month: 'short', timeZone: 'UTC' })} ${date.getUTCDate()}`;
    }),
    datasets: [{
      label: 'Daily Sales',
      data: graphData.map(d => d.value === 0 ? suggestedMin : d.value),
      fill: true,
      backgroundColor: 'rgba(29, 233, 182, 0.2)',
      borderColor: 'rgb(29, 233, 182)',
      tension: 0.1, pointRadius: 3, pointHoverRadius: 6,
    }],
  };

  const options = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      y: {
        type: 'logarithmic', min: suggestedMin, ticks: {
          callback: function (value) {
            const logVal = Math.log10(value);
            if (value === suggestedMin && suggestedMin < 1) return '$' + value.toFixed(2);
            if (Number.isInteger(logVal) && value >= 1) return '$' + value.toLocaleString();
            return null;
          },
        }
      },
      x: { ticks: { autoSkip: true, maxTicksLimit: 15 } }
    },
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Daily Sales - Last 30 Days (Logarithmic Scale)', font: { size: 16 } },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            const originalValue = graphData[context.dataIndex]?.value;
            if (originalValue !== null && originalValue !== undefined) label += formatCurrency(originalValue);
            return label;
          }
        }
      }
    },
  };

  return (
    <Card className="shadow-sm mb-4"><Card.Body><div style={{ height: '350px', position: 'relative' }}><Line data={dataForChart} options={options} /></div></Card.Body></Card>
  );
};
const LatestOrdersTable = ({ orders }) => { /* ... existing code ... */ 
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Card className="shadow-sm"><Card.Header as="h5">Latest Orders</Card.Header><Card.Body>
      <Table striped bordered hover responsive size="sm" className="mb-0 align-middle">
        <thead><tr><th>#ID</th><th>Client</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>{orders.map(order => (<tr key={order.orderId}><td>{order.orderId}</td><td>{order.clientName}</td><td>{formatCurrency(order.totalPrice)}</td><td><Badge bg={getStatusBadgeVariant(order.status)} pill className="px-2 py-1">{order.status}</Badge></td><td>{formatDate(order.created)}</td></tr>))}</tbody>
      </Table></Card.Body>
    </Card>
  );
};

// ================== START: MODIFIED AssignedOrdersTable COMPONENT ==================
const AssignedOrdersTable = ({ orders, onUpdateClick }) => {
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  
  return (
    <Card className="shadow-sm">
      <Card.Header as="h5">My Assigned Orders</Card.Header>
      <Card.Body>
        <Table striped bordered hover responsive size="sm" className="mb-0 align-middle">
          <thead>
            <tr>
              <th>#ID</th>
              <th>Client</th>
              <th>Total</th>
              <th>Status</th>
              <th>Date</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.orderId}>
                <td>{order.orderId}</td>
                <td>{order.clientName}</td>
                <td>{formatCurrency(order.totalPrice)}</td>
                <td><Badge bg={getStatusBadgeVariant(order.status)} pill className="px-2 py-1">{order.status}</Badge></td>
                <td>{formatDate(order.created)}</td>
                <td className="text-center">
                  <Button 
                    variant="outline-warning" 
                    size="sm" 
                    onClick={() => onUpdateClick(order)}
                    title="Update Order Status"
                  >
                    <ArrowClockwise /> <span className="d-none d-md-inline">Update Status</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
};
// ================== END: MODIFIED AssignedOrdersTable COMPONENT ==================

const DashDefault = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [userRole, setUserRole] = useState(null);
  
  // State for Manager Dashboard
  const [salesSummary, setSalesSummary] = useState(null);
  const [loadingSales, setLoadingSales] = useState(true);
  const [errorSales, setErrorSales] = useState(null);
  const [latestOrders, setLatestOrders] = useState([]);
  const [loadingLatestOrders, setLoadingLatestOrders] = useState(true);
  const [errorLatestOrders, setErrorLatestOrders] = useState(null);
  const [salesGraphData, setSalesGraphData] = useState([]);
  const [loadingSalesGraph, setLoadingSalesGraph] = useState(true);
  const [errorSalesGraph, setErrorSalesGraph] = useState(null);

  // State for Worker Dashboard
  const [assignedOrders, setAssignedOrders] = useState([]);
  const [loadingAssignedOrders, setLoadingAssignedOrders] = useState(true);
  const [errorAssignedOrders, setErrorAssignedOrders] = useState(null);

  // ================== START: ADDED STATE FOR UPDATE MODAL ==================
  const [orderToUpdate, setOrderToUpdate] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusDescription, setStatusDescription] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  // ================== END: ADDED STATE FOR UPDATE MODAL ==================

  const fetchAssignedOrders = useCallback(async () => {
      const config = getAuthConfig();
      if (!config) return;

      setLoadingAssignedOrders(true); 
      setErrorAssignedOrders(null);
      try {
        const response = await apiClient.get('/Orders/my-assigned-orders', config);
        setAssignedOrders(response.data);
      } catch (err) {
        setErrorAssignedOrders(err.message);
      } finally {
        setLoadingAssignedOrders(false);
      }
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    let role;
    try {
      const decodedToken = jwtDecode(token);
      const roleClaimName = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
      role = decodedToken[roleClaimName];
      setUserRole(role);
      setIsAuthenticated(true);
    } catch (e) {
      setIsAuthenticated(false);
      return;
    }
    
    const fetchData = async (url, setData, setLoading, setError) => {
        const config = getAuthConfig();
        if (!config) return;
        setLoading(true); setError(null);
        try {
          const response = await apiClient.get(url, config);
          setData(response.data);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    if (role) {
      if (role.toLowerCase() === 'worker') {
        fetchAssignedOrders();
        setLoadingSales(false);
        setLoadingLatestOrders(false);
        setLoadingSalesGraph(false);
      } else {
        fetchData(`${API_BASE_URL}/Orders/sales-summary`, setSalesSummary, setLoadingSales, setErrorSales);
        fetchData(`${API_BASE_URL}/Orders/sales-graph-data/daily-last-30-days`, setSalesGraphData, setLoadingSalesGraph, setErrorSalesGraph);
        fetchData(`${API_BASE_URL}/Orders/latest?count=5`, setLatestOrders, setLoadingLatestOrders, setErrorLatestOrders);
        setLoadingAssignedOrders(false);
      }
    }
  }, [fetchAssignedOrders]); // Added fetchAssignedOrders to dependency array

  // ================== START: ADDED MODAL HANDLER FUNCTIONS ==================
  const handleShowUpdateModal = (order) => {
    setOrderToUpdate(order);
    setNewStatus('');
    setStatusDescription('');
    setShowUpdateModal(true);
  };
  const handleCloseUpdateModal = () => {
    setShowUpdateModal(false);
    setOrderToUpdate(null);
  };

  const handleStatusUpdate = async (e) => {
      e.preventDefault();
      if (!orderToUpdate || !newStatus) {
          toast.warn('Please select a new status.');
          return;
      }
      setUpdatingStatus(true);
      const config = getAuthConfig();
      if (!config) {
          setUpdatingStatus(false);
          return;
      }
      const payload = { status: newStatus, description: statusDescription || `Status updated to ${newStatus}` };
      try {
          await apiClient.put(`/Orders/${orderToUpdate.orderId}/status`, payload, config);
          toast.success(`Order #${orderToUpdate.orderId} status updated successfully!`);
          handleCloseUpdateModal();
          fetchAssignedOrders(); // Refresh the list of assigned orders
      } catch (err) {
          const errorMsg = err.response?.data?.message || 'Failed to update status.';
          toast.error(`Update failed: ${errorMsg}`);
      } finally {
          setUpdatingStatus(false);
      }
  };
  // ================== END: ADDED MODAL HANDLER FUNCTIONS ==================

  const renderLoadingSpinner = (text = "Loading...") => (
    <div className="text-center p-4 my-3"><Spinner animation="border" role="status" size="sm" className="me-2" />{text}</div>
  );

  const renderFeedback = (isLoading, error, noDataCondition, noDataMessage, sectionNameForLoading, children) => {
    if (isLoading) return renderLoadingSpinner(`Loading ${sectionNameForLoading.toLowerCase()}...`);
    if (error) return <Alert variant="danger" className="my-4">Error loading {sectionNameForLoading.toLowerCase()}: {error}</Alert>;
    if (noDataCondition) return <Alert variant="info" className="my-4">{noDataMessage}</Alert>;
    return children || null;
  };

  if (isAuthenticated === null) {
    return <Container fluid className="d-flex justify-content-center align-items-center" style={{ minHeight: 'calc(100vh - 56px)' }}>{renderLoadingSpinner("Verifying authentication...")}</Container>;
  }

  if (!isAuthenticated) {
    return <WelcomeScreen />;
  }

  return (
    <Container fluid className="py-3 px-lg-4" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <h2 className="mb-4">Dashboard</h2>
      {/* ADDED: Toast Container for notifications */}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />

      {/* --- WORKER DASHBOARD VIEW --- */}
      {userRole && userRole.toLowerCase() === 'worker' && (
        <>
          <div className="p-5 mb-4 bg-light rounded-3 shadow-sm">
            <Container fluid className="py-2">
              <h1 className="display-5 fw-bold">Welcome!</h1>
              <p className="col-md-8 fs-4">
                Here is a list of all orders that are currently assigned to you.
              </p>
            </Container>
          </div>
          {renderFeedback(
            loadingAssignedOrders, 
            errorAssignedOrders,
            !loadingAssignedOrders && !errorAssignedOrders && assignedOrders.length === 0,
            "You have no orders assigned to you at the moment.", 
            "My Assigned Orders",
            // MODIFIED: Pass the handler function to the table component
            assignedOrders.length > 0 && <AssignedOrdersTable orders={assignedOrders} onUpdateClick={handleShowUpdateModal} />
          )}
        </>
      )}

      {/* --- MANAGER DASHBOARD VIEW --- */}
      {userRole && userRole.toLowerCase() !== 'worker' && (
        <>
          <h4 className="mb-3">Sales Overview</h4>
          {renderFeedback(
            loadingSales, 
            errorSales,
            !loadingSales && !errorSales && !salesSummary,
            "Sales overview data is currently unavailable.", 
            "Sales Overview",
            salesSummary && (
              <Row className="mb-4">
                <SalesCard title="Daily Sales" data={salesSummary.dailySales} />
                <SalesCard title="Monthly Sales" data={salesSummary.monthlySales} />
                <SalesCard title="Yearly Sales" data={salesSummary.yearlySales} />
              </Row>
            )
          )}
          {renderFeedback(
            loadingSalesGraph, 
            errorSalesGraph,
            !loadingSalesGraph && !errorSalesGraph && salesGraphData.length === 0,
            "No data available for sales graph.", 
            "Sales Graph",
            salesGraphData.length > 0 && <SalesGraph graphData={salesGraphData} />
          )}
          <hr className="my-4" />
          {renderFeedback(
            loadingLatestOrders, 
            errorLatestOrders,
            !loadingLatestOrders && !errorLatestOrders && latestOrders.length === 0,
            "No recent orders found.", 
            "Latest Orders",
            latestOrders.length > 0 && <LatestOrdersTable orders={latestOrders} />
          )}
        </>
      )}

      {/* ================== START: ADDED UPDATE STATUS MODAL ================== */}
      <Modal show={showUpdateModal} onHide={handleCloseUpdateModal} centered backdrop="static">
          <Modal.Header closeButton>
              <Modal.Title>Update Status for Order #{orderToUpdate?.orderId}</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleStatusUpdate}>
              <Modal.Body>
                  <p>Current Status: <Badge bg={getStatusBadgeVariant(orderToUpdate?.status)}>{orderToUpdate?.status}</Badge></p>
                  <Form.Group className="mb-3" controlId="newStatusSelect">
                      <Form.Label>New Status</Form.Label>
                      <Form.Select aria-label="Select new status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} required>
                          <option value="" disabled>-- Select Status --</option>
                          {/* This logic correctly shows only the options available to a Worker */}
                          {userRole === 'Worker' && orderToUpdate?.status === 'ReadyForDelivery' && (
                            <>
                              <option value="InTransit">In Transit</option>
                              <option value="Completed">Completed</option>
                            </>
                          )}
                          {userRole === 'Worker' && orderToUpdate?.status === 'InTransit' && (
                            <>
                              <option value="Returned">Returned</option>
                              <option value="Completed">Completed</option>
                            </>
                          )}
                      </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="statusDescription">
                      <Form.Label>Description (Optional)</Form.Label>
                      <Form.Control 
                        as="textarea" 
                        rows={2} 
                        value={statusDescription} 
                        onChange={(e) => setStatusDescription(e.target.value)} 
                        placeholder="Reason for status change..." 
                      />
                  </Form.Group>
              </Modal.Body>
              <Modal.Footer>
                  <Button variant="secondary" onClick={handleCloseUpdateModal} disabled={updatingStatus}>Cancel</Button>
                  <Button variant="warning" type="submit" disabled={updatingStatus || !newStatus}>
                      {updatingStatus 
                        ? (<><Spinner as="span" animation="border" size="sm" /> <span className="ms-1">Updating...</span></>) 
                        : (<><ArrowClockwise className="me-2" /> Update Status</>)
                      }
                  </Button>
              </Modal.Footer>
          </Form>
      </Modal>
      {/* ================== END: ADDED UPDATE STATUS MODAL ================== */}

    </Container>
  );
};

export default DashDefault;