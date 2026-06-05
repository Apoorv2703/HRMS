const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Enable CORS with support for HttpOnly credentials cookies
app.use(
  cors({
    origin: (origin, callback) => {
      // In development, allow localhost or undefined (e.g. tools, postman)
      // In production, configure whitelist or subdomain wildcard match
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Route Registrations
app.use('/api/v1/auth', authRoutes);

// Root path diagnostic endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Centralized Error-Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error Exception:', err);
  
  // Format target Mongoose validation or MongoDB cast errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // Handle unique validation index duplicate error
  if (err.code === 11000) {
    return res.status(400).json({ error: 'Duplicate record exists in system.' });
  }

  return res.status(res.statusCode === 200 ? 500 : res.statusCode).json({
    error: err.message || 'An unexpected operational failure occurred on the server.',
  });
});

module.exports = app;
