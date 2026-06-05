import mongoose from 'mongoose';

const connectDB = async () => {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms_db';
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`DB Connection Success : ${mongoose.connection.name}`);
  } catch (err) {
    console.error('Database connection failed. Exiting process...', err);
    process.exit(1);
  }
};

export default connectDB;
