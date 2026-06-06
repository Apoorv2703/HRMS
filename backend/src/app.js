import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import orgRoutes from './routes/orgRoutes.js';
import attendanceConfigRoutes from './routes/attendanceConfigRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import leaveRoutes from './routes/leaveRoutes.js';
import payslipRoutes from './routes/payslipRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

const app = express();


// Enable CORS with support for HttpOnly credentials cookies
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// Route Registrations
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/organization', orgRoutes);
app.use('/api/v1/attendance-config', attendanceConfigRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/leaves', leaveRoutes);
app.use('/api/v1/payslips', payslipRoutes);
app.use('/api/v1/workflows', workflowRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/reports', reportRoutes);

// Root path diagnostic endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Centralized Error-Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error Exception:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === 11000) {
    return res.status(400).json({ error: 'Duplicate record exists in system.' });
  }

  return res.status(res.statusCode === 200 ? 500 : res.statusCode).json({
    error: err.message || 'An unexpected operational failure occurred on the server.',
  });
});

export default app;
