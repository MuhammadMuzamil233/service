const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const models = require('../models');

const DB_FILE = path.join(__dirname, '..', '..', 'data', 'db.json');

let isConnected = false;

/**
 * Connect to MongoDB Cluster or Local MongoDB Instance
 */
async function connectMongo() {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.trim() === '' || uri.includes('<username>')) {
    console.log('ℹ️  [MongoDB] MONGODB_URI not configured in .env. Active storage: data/db.json (Local Fallback)');
    isConnected = false;
    return false;
  }

  try {
    console.log('⏳ [MongoDB] Connecting to MongoDB...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    isConnected = true;
    console.log('🍃 [MongoDB] Successfully connected to MongoDB Cluster!');

    // Run auto-migration / seed sync from db.json if collections are empty
    await migrateSeedsToMongo();

    return true;
  } catch (err) {
    console.error('❌ [MongoDB] Connection error:', err.message);
    console.log('⚠️  [MongoDB] Fallback active: Serving from local JSON database (data/db.json).');
    isConnected = false;
    return false;
  }
}

// Connection event listeners
mongoose.connection.on('connected', () => {
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('❌ [MongoDB] Runtime error:', err.message);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.log('⚠️  [MongoDB] Connection disconnected.');
});

/**
 * Check if MongoDB is currently live and connected
 */
function isMongoConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Automatically migrate and seed initial data from db.json to MongoDB
 */
async function migrateSeedsToMongo() {
  try {
    const userCount = await models.User.countDocuments();
    let localData = null;

    if (fs.existsSync(DB_FILE)) {
      try {
        localData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      } catch (e) {}
    }

    if (!localData) {
      const { getInitialDb } = require('./db');
      localData = typeof getInitialDb === 'function' ? getInitialDb() : null;
    }

    if (!localData) return;

    // 1. Seed / Sync Users
    if (userCount === 0 && localData.users && localData.users.length > 0) {
      console.log(`📦 [MongoDB Seed] Migrating ${localData.users.length} users into MongoDB...`);
      for (const u of localData.users) {
        await models.User.findOneAndUpdate({ id: u.id }, u, { upsert: true, new: true });
      }
    }

    // 2. Seed / Sync Technicians
    const techCount = await models.Technician.countDocuments();
    if (techCount === 0 && localData.technicians && localData.technicians.length > 0) {
      console.log(`📦 [MongoDB Seed] Migrating ${localData.technicians.length} technicians into MongoDB...`);
      for (const t of localData.technicians) {
        await models.Technician.findOneAndUpdate({ id: t.id }, t, { upsert: true, new: true });
      }
    }

    // 3. Seed / Sync Services
    const serviceCount = await models.Service.countDocuments();
    if (serviceCount === 0 && localData.services && localData.services.length > 0) {
      console.log(`📦 [MongoDB Seed] Migrating ${localData.services.length} services into MongoDB...`);
      for (const s of localData.services) {
        await models.Service.findOneAndUpdate({ id: s.id }, s, { upsert: true, new: true });
      }
    }

    // 4. Seed / Sync Tickets
    const ticketCount = await models.Ticket.countDocuments();
    if (ticketCount === 0 && localData.tickets && localData.tickets.length > 0) {
      console.log(`📦 [MongoDB Seed] Migrating ${localData.tickets.length} tickets into MongoDB...`);
      for (const tk of localData.tickets) {
        await models.Ticket.findOneAndUpdate({ id: tk.id }, tk, { upsert: true, new: true });
      }
    }

    // 5. Seed / Sync Chats
    const chatCount = await models.Chat.countDocuments();
    if (chatCount === 0 && localData.chats && localData.chats.length > 0) {
      for (const c of localData.chats) {
        await models.Chat.findOneAndUpdate({ sessionId: c.sessionId }, c, { upsert: true, new: true });
      }
    }

    // 6. Seed Reviews & Inquiries
    if (localData.reviews && (await models.Review.countDocuments()) === 0) {
      for (const r of localData.reviews) {
        await models.Review.findOneAndUpdate({ id: r.id }, r, { upsert: true, new: true });
      }
    }
    if (localData.inquiries && (await models.Inquiry.countDocuments()) === 0) {
      for (const i of localData.inquiries) {
        await models.Inquiry.findOneAndUpdate({ id: i.id }, i, { upsert: true, new: true });
      }
    }

    console.log('✅ [MongoDB Seed] Migration & seed sync complete.');
  } catch (err) {
    console.error('Error migrating seeds to MongoDB:', err);
  }
}

/**
 * Load all documents from MongoDB collections into plain JS object
 */
async function loadAllFromMongo() {
  try {
    if (!isMongoConnected()) return null;

    const [users, technicians, tickets, chats, services, inquiries, reviews] = await Promise.all([
      models.User.find({}).lean(),
      models.Technician.find({}).lean(),
      models.Ticket.find({}).lean(),
      models.Chat.find({}).lean(),
      models.Service.find({}).lean(),
      models.Inquiry.find({}).lean(),
      models.Review.find({}).lean()
    ]);

    return {
      users: users.map(cleanMongoDoc),
      technicians: technicians.map(cleanMongoDoc),
      tickets: tickets.map(cleanMongoDoc),
      chats: chats.map(cleanMongoDoc),
      services: services.map(cleanMongoDoc),
      inquiries: inquiries.map(cleanMongoDoc),
      reviews: reviews.map(cleanMongoDoc)
    };
  } catch (err) {
    console.error('Error loading data from MongoDB:', err);
    return null;
  }
}

/**
 * Remove MongoDB internal _id & __v for complete frontend/JSON parity
 */
function cleanMongoDoc(doc) {
  if (!doc) return doc;
  const { _id, __v, ...rest } = doc;
  return rest;
}

/**
 * Background Asynchronous Sync to MongoDB collections
 */
async function syncAllToMongo(data) {
  if (!isMongoConnected() || !data) return;

  try {
    // 1. Sync Users
    if (Array.isArray(data.users)) {
      const userBulk = data.users.map(u => ({
        updateOne: {
          filter: { id: u.id },
          update: { $set: u },
          upsert: true
        }
      }));
      if (userBulk.length > 0) {
        await models.User.bulkWrite(userBulk);
        const existingIds = data.users.map(u => u.id);
        await models.User.deleteMany({ id: { $nin: existingIds } });
      }
    }

    // 2. Sync Technicians
    if (Array.isArray(data.technicians)) {
      const techBulk = data.technicians.map(t => ({
        updateOne: {
          filter: { id: t.id },
          update: { $set: t },
          upsert: true
        }
      }));
      if (techBulk.length > 0) {
        await models.Technician.bulkWrite(techBulk);
        const existingIds = data.technicians.map(t => t.id);
        await models.Technician.deleteMany({ id: { $nin: existingIds } });
      }
    }

    // 3. Sync Tickets
    if (Array.isArray(data.tickets)) {
      const ticketBulk = data.tickets.map(tk => ({
        updateOne: {
          filter: { id: tk.id },
          update: { $set: tk },
          upsert: true
        }
      }));
      if (ticketBulk.length > 0) {
        await models.Ticket.bulkWrite(ticketBulk);
        const existingIds = data.tickets.map(tk => tk.id);
        await models.Ticket.deleteMany({ id: { $nin: existingIds } });
      }
    }

    // 4. Sync Chats
    if (Array.isArray(data.chats)) {
      const chatBulk = data.chats.map(c => ({
        updateOne: {
          filter: { sessionId: c.sessionId },
          update: { $set: c },
          upsert: true
        }
      }));
      if (chatBulk.length > 0) {
        await models.Chat.bulkWrite(chatBulk);
      }
    }
  } catch (err) {
    console.error('Error syncing data to MongoDB:', err.message);
  }
}

module.exports = {
  connectMongo,
  isMongoConnected,
  migrateSeedsToMongo,
  loadAllFromMongo,
  syncAllToMongo,
  models
};
