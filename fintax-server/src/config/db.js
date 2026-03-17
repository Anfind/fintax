const mongoose = require('mongoose');
const env = require('./env');

let webDb = null;
let crawlerDb = null;

const connectDB = async () => {
  try {
    // Main connection for fintax_web
    const conn = await mongoose.connect(env.mongodbUri, {
      dbName: env.dbName,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    webDb = conn.connection;
    console.log(`✓ MongoDB connected: ${env.dbName} @ ${conn.connection.host}`);

    // Secondary connection for reading crawler data
    crawlerDb = conn.connection.useDb(env.crawlerDbName);
    console.log(`✓ Crawler DB linked: ${env.crawlerDbName}`);

    return { webDb, crawlerDb };
  } catch (error) {
    console.error('✗ MongoDB connection error:', error.message);
    throw error;
  }
};

const getWebDb = () => webDb;
const getCrawlerDb = () => crawlerDb;

module.exports = { connectDB, getWebDb, getCrawlerDb };
