import connectDB from './config/config.js';
import app from './app.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to database
  await connectDB();

  // Start HTTP Server with port collision handling
  const server = app.listen(PORT, () => {
    console.log(`HRMS API Server is running on port ${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[Server Error]: Port ${PORT} is already occupied. Please free this port or configure another PORT in your .env file.\n`);
      process.exit(1);
    } else {
      throw err;
    }
  });
};

startServer();
