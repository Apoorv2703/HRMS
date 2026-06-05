const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment configurations
dotenv.config();

const app = require('./app');
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms_db';

// Connect to MongoDB Database
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB database successfully.');
    
    // Start HTTP Server
    app.listen(PORT, () => {
      console.log(`HRMS API Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed. Exiting process...', err);
    process.exit(1);
  });
