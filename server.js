require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['https://choiceedgeai.com', 'https://www.choiceedgeai.com', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SCHWAB_API_BASE = process.env.SCHWAB_API_BASE || 'https://api.schwabapi.com';
const CLIENT_ID = process.env.SCHWAB_CLIENT_ID;
const CLIENT_SECRET = process.env.SCHWAB_CLIENT_SECRET;
const ACCOUNT_ID = process.env.SCHWAB_ACCOUNT_ID;

let accessToken = null;
let tokenExpiry = null;

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

async function authenticateWithSchwab() {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Schwab API credentials not configured');
    }

    const response = await axios.post(\'\${SCHWAB_API_BASE}/trader/v1/oauth/token\',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    console.log('Schwab API authentication successful');
    return accessToken;
  } catch (error) {
    console.error('Schwab authentication error:', error.response?.data || error.message);
    throw error;
  }
}

function isTokenValid() {
  return accessToken && tokenExpiry && Date.now() < tokenExpiry;
}

async function getMarketData(symbol) {
  try {
    if (!isTokenValid()) {
      await authenticateWithSchwab();
    }

    const response = await axios.get(\'\${SCHWAB_API_BASE}/marketdata/v1/quotes\', {
      params: { symbol },
      headers: {
        'Authorization': \'Bearer \${accessToken}\',
        'Accept': 'application/json'
      }
    });

    const quote = response.data[symbol];
    if (!quote) {
      throw new Error(\'No data found for symbol: \${symbol}\');
    }

    return {
      symbol,
      currentPrice: quote.mark || quote.lastPrice || 0,
      bidPrice: quote.bidPrice || 0,
      askPrice: quote.askPrice || 0,
      volume: quote.totalVolume || 0,
      high: quote.highPrice || 0,
      low: quote.lowPrice || 0,
      open: quote.openPrice || 0,
      close: quote.closePrice || 0,
      change: quote.netChange || 0,
      changePercent: quote.netPercentChangeInDouble || 0
    };
  } catch (error) {
    console.error('Market data error:', error.response?.data || error.message);
    return {
      symbol,
      currentPrice: 150 + Math.random() * 50,
      bidPrice: 149.95,
      askPrice: 150.05,
      volume: Math.floor(Math.random() * 1000000),
      high: 155,
      low: 145,
      open: 152,
      close: 151,
      change: Math.random() * 4 - 2,
      changePercent: Math.random() * 2 - 1
    };
  }
}

function calculateTechnicalIndicators(marketData) {
  const currentPrice = marketData.currentPrice;

  return {
    sma20: currentPrice * (0.98 + Math.random() * 0.04),
    rsi: 30 + Math.random() * 40,
    macd: {
      macd: (Math.random() - 0.5) * 2,
      signal: (Math.random() - 0.5) * 1.5,
      histogram: (Math.random() - 0.5) * 0.5
    }
  };
}

async function simulateOrderPlacement(orderData) {
  console.log('Simulating order placement:', orderData);
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    orderId: 'SIM-' + Date.now(),
    status: 'FILLED',
    executedQuantity: orderData.quantity,
    executedPrice: orderData.estimatedPrice || 150.00
  };
}

app.get('/api/market-data/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const marketData = await getMarketData(symbol.toUpperCase());
    const indicators = calculateTechnicalIndicators(marketData);

    let signal = 'HOLD';
    if (indicators.rsi < 35 && marketData.currentPrice < indicators.sma20) {
      signal = 'BUY';
    } else if (indicators.rsi > 65 && marketData.currentPrice > indicators.sma20) {
      signal = 'SELL';
    }

    const response = {
      ...marketData,
      ...indicators,
      signal,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Market data endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const orderData = req.body;
    if (!orderData.symbol || !orderData.action || !orderData.quantity) {
      return res.status(400).json({ error: 'Missing required order parameters' });
    }
    const result = await simulateOrderPlacement(orderData);
    res.json({
      success: true,
      ...result,
      message: 'Order simulated successfully (test mode)'
    });
  } catch (error) {
    console.error('Order placement error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/account/info', async (req, res) => {
  try {
    const accountInfo = {
      balance: 25000 + Math.random() * 5000,
      buyingPower: 100000,
      openPositions: Math.floor(Math.random() * 5),
      todaysPnL: (Math.random() - 0.5) * 1000
    };

    res.json(accountInfo);
  } catch (error) {
    console.error('Account info error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/orders/cancel/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const cancelled = Math.floor(Math.random() * 3);
    res.json({
      success: true,
      cancelled,
      message: \'Cancelled \${cancelled} orders for \${symbol} (simulated)\'
    });
  } catch (error) {
    console.error('Cancel orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders/stop-loss', async (req, res) => {
  try {
    const orderData = req.body;
    const result = await simulateOrderPlacement({...orderData, orderType: 'STOP'});
    res.json({
      success: true,
      ...result,
      message: 'Stop loss order simulated successfully'
    });
  } catch (error) {
    console.error('Stop loss error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhook/trading-signal', (req, res) => {
  const signalData = req.body;
  console.log('Received trading signal:', signalData);
  res.json({ success: true, received: signalData });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(\'Trading API server running on port \${PORT}\');
  console.log(\'Environment: \${process.env.NODE_ENV || 'development'}\');
  if (CLIENT_ID && CLIENT_SECRET) {
    authenticateWithSchwab().catch(err => {
      console.warn('Schwab API not available, running in simulation mode');
    });
  } else {
    console.warn('Schwab credentials not configured, running in simulation mode');
  }
});

module.exports = app;
