import React, { useState, useEffect } from 'react';

// Helper function to determine trend icon and color
const getTrendIndicator = (trend) => {
  if (trend === 'up') {
    return { icon: '↑', color: 'green' };
  } else if (trend === 'down') {
    return { icon: '↓', color: 'red' };
  }
  return { icon: '–', color: 'gray' }; // Neutral
};

const SESSION_STORAGE_KEYS = {
    TOKEN: 'authToken',
    REFRESH_TOKEN: 'refreshToken',
    USER_ID: 'userId',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
};

// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  // Adjust 'en-US' and 'USD' based on your locale and currency
};

const SalesCard = ({ title, data }) => {
  // Log the data received by SalesCard - VERY IMPORTANT FOR DEBUGGING
  console.log(`SalesCard data for "${title}":`, data);

  if (!data) {
    return (
      <div style={styles.card}>
        <h3>{title}</h3>
        <p>Loading data...</p>
      </div>
    );
  }

  const trendIndicator = getTrendIndicator(data.trend);

  // Robust handling for percentageChange
  const percentageChangeDisplay = (typeof data.percentageChange === 'number' && !isNaN(data.percentageChange))
    ? `${data.percentageChange >= 0 ? '+' : ''}${data.percentageChange.toFixed(1)}%`
    : 'N/A'; // Display N/A if not a valid number

  // Robust handling for progressBarPercentage
  const progressBarValue = (typeof data.progressBarPercentage === 'number' && !isNaN(data.progressBarPercentage))
    ? Math.round(data.progressBarPercentage)
    : 0; // Default to 0 if not a valid number

  return (
    <div style={styles.card}>
      <h3>{title}</h3>
      <div style={styles.salesInfo}>
        <span style={{ color: trendIndicator.color, fontSize: '24px', marginRight: '8px' }}>
          {trendIndicator.icon}
        </span>
        <span style={styles.amount}>{formatCurrency(data.amount)}</span>
      </div>
      <div style={styles.percentageContainer}>
        <span style={{ color: trendIndicator.color }}>
            {percentageChangeDisplay}
        </span>
      </div>
      <div style={styles.progressBarContainer}>
        <div
          style={{
            ...styles.progressBar,
            width: `${progressBarValue}%`, // Use robust value
            backgroundColor: title === "Daily Sales" ? '#1DE9B6' : title === "Monthly Sales" ? '#8A2BE2' : '#007BFF'
          }}
        ></div>
      </div>
      <div style={styles.progressPercentageText}>
        {progressBarValue}% {/* Use robust value */}
      </div>
    </div>
  );
};

const DashDefault = () => {
  const [salesSummary, setSalesSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSalesSummary = async () => {
      setLoading(true);
      setError(null);

      // Get token inside useEffect to ensure it's current
      const token = sessionStorage.getItem(SESSION_STORAGE_KEYS.TOKEN);

      if (!token) {
        setError("Authentication token not found. Please ensure you are logged in.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('https://localhost:7204/api/Orders/sales-summary', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`, // Use the token fetched inside useEffect
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch (e) {
            errorData = { message: response.statusText };
          }
          console.error("API Error Response:", errorData); // Log the actual error from API
          throw new Error(`HTTP error! status: ${response.status} - ${errorData.message || 'Failed to fetch'}`);
        }

        const data = await response.json();
        console.log("Fetched sales summary from API:", data); // Log the full API response
        setSalesSummary(data);
      } catch (err) {
        console.error("Failed to fetch sales summary (catch block):", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSalesSummary();
  }, []); // Empty dependency array means this effect runs once on mount

  if (loading) {
    return <div style={styles.container}><p>Loading dashboard data...</p></div>;
  }

  if (error) {
    return <div style={styles.container}><p style={{color: 'red'}}>Error loading data: {error}</p></div>;
  }

  // Add a check to ensure salesSummary and its nested properties exist before rendering SalesCard
  if (!salesSummary || !salesSummary.dailySales || !salesSummary.monthlySales || !salesSummary.yearlySales) {
    return <div style={styles.container}><p>Sales data is incomplete or unavailable.</p></div>;
  }

  return (
    <div style={styles.dashboardContainer}>
      <h2>Sales Overview</h2>
      <div style={styles.cardsContainer}>
        <SalesCard title="Daily Sales" data={salesSummary.dailySales} />
        <SalesCard title="Monthly Sales" data={salesSummary.monthlySales} />
        <SalesCard title="Yearly Sales" data={salesSummary.yearlySales} />
      </div>
    </div>
  );
};

// Basic inline styles
const styles = {
  dashboardContainer: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  cardsContainer: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
  },
  card: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    minWidth: '250px',
    flex: 1,
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  salesInfo: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px',
  },
  amount: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
  },
  percentageContainer: {
    marginBottom: '15px',
    fontSize: '14px',
    color: '#555',
  },
  progressBarContainer: {
    height: '10px',
    backgroundColor: '#e9ecef',
    borderRadius: '5px',
    overflow: 'hidden',
    marginBottom: '5px',
  },
  progressBar: {
    height: '100%',
    transition: 'width 0.5s ease-in-out',
  },
  progressPercentageText: {
    textAlign: 'right',
    fontSize: '12px',
    color: '#777',
  },
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px', 
    fontSize: '18px',
  }
};

export default DashDefault;