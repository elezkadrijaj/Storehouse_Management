import React, { useState, useEffect } from 'react';

// React-Bootstrap components
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';

// Chart.js components
import { Line } from 'react-chartjs-2';
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
  LogarithmicScale // Ensure this is imported for the log scale
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LogarithmicScale // Register the logarithmic scale
);

const getTrendIndicator = (trend) => {
  if (trend === 'up') return { icon: '↑', colorClass: 'text-success' };
  if (trend === 'down') return { icon: '↓', colorClass: 'text-danger' };
  return { icon: '–', colorClass: 'text-muted' };
};

const SESSION_STORAGE_KEYS = {
  TOKEN: 'authToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_ID: 'userId',
  USER_ROLE: 'userRole',
  USER_NAME: 'userName',
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
};

const SalesCard = ({ title, data }) => {
  // This component assumes 'data' is already loaded and valid by the parent
  const trendIndicator = getTrendIndicator(data.trend);
  const percentageChangeDisplay = (typeof data.percentageChange === 'number' && !isNaN(data.percentageChange))
    ? `${data.percentageChange >= 0 ? '+' : ''}${data.percentageChange.toFixed(1)}%`
    : 'N/A';
  const progressBarValue = (typeof data.progressBarPercentage === 'number' && !isNaN(data.progressBarPercentage))
    ? Math.round(data.progressBarPercentage)
    : 0;

  let progressBarVariant;
  if (title === "Daily Sales") progressBarVariant = "info"; // Corresponds to the teal color
  else if (title === "Monthly Sales") progressBarVariant = "secondary"; // Example for purple-ish
  else progressBarVariant = "primary"; // Example for blue

  return (
    <Col md={4} className="mb-4">
      <Card className="h-100 shadow-sm">
        <Card.Body className="d-flex flex-column">
          <Card.Title as="h5" className="mb-3">{title}</Card.Title>
          <div className="d-flex align-items-center mb-2">
            <span className={`${trendIndicator.colorClass} fs-4 me-2`}>
              {trendIndicator.icon}
            </span>
            <span className="h3 mb-0 fw-bold">{formatCurrency(data.amount)}</span>
          </div>
          <div className="mb-3">
            <span className={`${trendIndicator.colorClass} small`}>
              {percentageChangeDisplay}
            </span>
          </div>
          <ProgressBar
            now={progressBarValue}
            variant={progressBarVariant}
            style={{ height: '8px' }}
            className="mb-1"
          />
          <p className="text-end small text-muted mt-0 mb-0">{progressBarValue}%</p>
        </Card.Body>
      </Card>
    </Col>
  );
};

const SalesGraph = ({ graphData }) => {
  const nonZeroSales = graphData.filter(d => d.value > 0).map(d => d.value);
  let suggestedMin = 0.1; // Default small value if all sales are 0 or very low
  if (nonZeroSales.length > 0) {
    const minSale = Math.min(...nonZeroSales);
    suggestedMin = Math.max(0.01, Math.min(1, minSale / 10)); // Ensure it's not too tiny or too large
  }

  const dataForChart = {
    labels: graphData.map(d => {
        const date = new Date(d.label + 'T00:00:00Z'); // Treat date string as UTC to avoid timezone interpretation issues
        return `${date.toLocaleString('default', { month: 'short', timeZone: 'UTC' })} ${date.getUTCDate()}`;
    }),
    datasets: [
      {
        label: 'Daily Sales',
        data: graphData.map(d => d.value === 0 ? suggestedMin : d.value),
        fill: true,
        backgroundColor: 'rgba(29, 233, 182, 0.2)', // Teal, matching Daily Sales card approx.
        borderColor: 'rgb(29, 233, 182)',
        tension: 0.1, pointRadius: 3, pointHoverRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true, maintainAspectRatio: false,
    scales: {
      y: {
        type: 'logarithmic',
        min: suggestedMin,
        ticks: {
          callback: function(value) {
            const logVal = Math.log10(value);
            if (value === suggestedMin && suggestedMin < 1) return '$' + value.toFixed(2);
            if (Number.isInteger(logVal) && value >=1 ) return '$' + value.toLocaleString();
            return null;
          },
        },
      },
      x: { ticks: { autoSkip: true, maxTicksLimit: 15 } }
    },
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Daily Sales - Last 30 Days (Logarithmic Scale)', font: { size: 16 } },
      tooltip: {
        callbacks: {
            label: function(context) {
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
    <Card className="shadow-sm mb-4">
      <Card.Body>
        <div style={{ height: '350px', position: 'relative' }}>
          <Line data={dataForChart} options={options} />
        </div>
      </Card.Body>
    </Card>
  );
};

const LatestOrdersTable = ({ orders }) => {
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const getStatusBadgeVariant = (status) => {
    switch (status?.toLowerCase()) {
      case 'created': return "secondary";
      case 'completed': case 'shipped': case 'delivered': case 'paid': return "success";
      case 'canceled': return "dark";
      case 'processing': return "info";
      default: return "light";
    }
  };

  return (
    <Card className="shadow-sm">
      <Card.Header as="h5">Latest Orders</Card.Header>
      <Card.Body>
        <Table striped bordered hover responsive size="sm" className="mb-0 align-middle">
          <thead>
            <tr>
              <th>#ID</th>
              <th>Client</th>
              <th>Total</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.orderId}>
                <td>{order.orderId}</td>
                <td>{order.clientName}</td>
                <td>{formatCurrency(order.totalPrice)}</td>
                <td>
                  <Badge bg={getStatusBadgeVariant(order.status)} pill className="px-2 py-1">
                    {order.status}
                  </Badge>
                </td>
                <td>{formatDate(order.created)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
};

const DashDefault = () => {
  const [salesSummary, setSalesSummary] = useState(null);
  const [loadingSales, setLoadingSales] = useState(true);
  const [errorSales, setErrorSales] = useState(null);

  const [latestOrders, setLatestOrders] = useState([]);
  const [loadingLatestOrders, setLoadingLatestOrders] = useState(true);
  const [errorLatestOrders, setErrorLatestOrders] = useState(null);

  const [salesGraphData, setSalesGraphData] = useState([]);
  const [loadingSalesGraph, setLoadingSalesGraph] = useState(true);
  const [errorSalesGraph, setErrorSalesGraph] = useState(null);

  useEffect(() => {
    const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);
    const authError = "Authentication token not found. Please log in.";

    if (!token) {
      setErrorSales(authError); setLoadingSales(false);
      setErrorLatestOrders(authError); setLoadingLatestOrders(false);
      setErrorSalesGraph(authError); setLoadingSalesGraph(false);
      return;
    }

    const fetchData = async (url, setData, setLoading, setError, sectionName) => {
      setLoading(true); setError(null);
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
          let errorData; try { errorData = await response.json(); } catch (e) { errorData = { message: response.statusText }; }
          console.error(`API Error (${sectionName}):`, errorData);
          throw new Error(`${sectionName}: ${response.status} - ${errorData.message || 'Failed to fetch'}`);
        }
        const data = await response.json();
        setData(data);
      } catch (err) { console.error(`Fetch Error (${sectionName}):`, err); setError(err.message); }
      finally { setLoading(false); }
    };

    fetchData('https://localhost:7204/api/Orders/sales-summary', setSalesSummary, setLoadingSales, setErrorSales, 'Sales Summary');
    fetchData('https://localhost:7204/api/Orders/latest?count=5', setLatestOrders, setLoadingLatestOrders, setErrorLatestOrders, 'Latest Orders');
    fetchData('https://localhost:7204/api/Orders/sales-graph-data/daily-last-30-days', setSalesGraphData, setLoadingSalesGraph, setErrorSalesGraph, 'Sales Graph');

  }, []);

  const renderLoadingSpinner = (text = "Loading...") => (
    <div className="text-center p-4 my-3">
      <Spinner animation="border" role="status" size="sm" className="me-2" />
      {text}
    </div>
  );

  const renderFeedback = (isLoading, error, noDataCondition, noDataMessage, sectionNameForLoading, children) => {
    if (isLoading) return renderLoadingSpinner(`Loading ${sectionNameForLoading.toLowerCase()}...`);
    if (error) return <Alert variant="danger" className="my-4">Error loading {sectionNameForLoading.toLowerCase()}: {error}</Alert>;
    if (!children && noDataCondition) { // If children is falsy (e.g. initial state or failed condition) AND specific noData is met
        return <Alert variant="info" className="my-4">{noDataMessage}</Alert>;
    }
    if (children && noDataCondition) { // If children is truthy but would render "no data" (e.g. empty array)
         return <Alert variant="info" className="my-4">{noDataMessage}</Alert>;
    }
    return children || null; // Render children if valid, otherwise null
  };

  if (loadingSales && loadingLatestOrders && loadingSalesGraph) {
    return (
      <Container fluid className="d-flex justify-content-center align-items-center" style={{ minHeight: 'calc(100vh - 56px)' }}>
        {renderLoadingSpinner("Loading dashboard data...")}
      </Container>
    );
  }

  return (
    <Container fluid className="py-3 px-lg-4" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <h2 className="mb-4">Dashboard</h2>

      <h4 className="mb-3">Sales Overview</h4>
      {renderFeedback(
        loadingSales,
        errorSales,
        (!loadingSales && !errorSales && (!salesSummary || !salesSummary.dailySales || !salesSummary.monthlySales || !salesSummary.yearlySales)),
        "Sales overview data is currently unavailable.",
        "Sales Overview",
        salesSummary && salesSummary.dailySales && salesSummary.monthlySales && salesSummary.yearlySales && (
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
        (!loadingSalesGraph && !errorSalesGraph && salesGraphData.length === 0),
        "No data available for sales graph.",
        "Sales Graph",
        salesGraphData.length > 0 && <SalesGraph graphData={salesGraphData} />
      )}

      <hr className="my-4" /> {/* Bootstrap class for margin */}

      {renderFeedback(
        loadingLatestOrders,
        errorLatestOrders,
        (!loadingLatestOrders && !errorLatestOrders && latestOrders.length === 0),
        "No recent orders found.",
        "Latest Orders",
        latestOrders.length > 0 && (
            <div className="mt-0"> {/* Removed mt-4 as hr provides spacing */}
                <LatestOrdersTable orders={latestOrders} />
            </div>
        )
      )}
    </Container>
  );
};

export default DashDefault;