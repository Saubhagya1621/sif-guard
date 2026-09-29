const mongoose = require('mongoose');
const env = require('./env');

async function connectDB(uri = env.MONGO_URI) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`[db] connected to ${uri.replace(/\/\/[^@]*@/, '//***@')}`);
}

module.exports = { connectDB };
