const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { DEFAULT_SERVICES, DEFAULT_TECHNICIANS } = require('./constants');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Memory cache
let dbCache = null;
let lastMtime = 0;
let isWriting = false;
let pendingSave = null;

function getInitialDb() {
  const adminPasswordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);

  return {
    users: [
      {
        id: 'usr_admin_01',
        name: process.env.ADMIN_NAME || 'Super Admin',
        email: (process.env.ADMIN_EMAIL || 'admin@proservice.com').toLowerCase(),
        password: adminPasswordHash,
        role: 'admin',
        createdAt: new Date().toISOString()
      },
      ...DEFAULT_TECHNICIANS.map(tech => ({
        id: `usr_${tech.id.toLowerCase()}`,
        name: tech.name,
        email: tech.email.toLowerCase(),
        password: bcrypt.hashSync('tech123', 10),
        role: 'technician',
        technicianId: tech.id,
        specialty: tech.specialty,
        phone: tech.phone,
        createdAt: new Date().toISOString()
      }))
    ],
    services: DEFAULT_SERVICES,
    technicians: DEFAULT_TECHNICIANS,
    tickets: [
      {
        id: 'TKT-82910',
        customerName: 'Muhammad Ali',
        phone: '0300-1234567',
        serviceType: 'camera',
        serviceName: 'Camera Installation (CCTV)',
        address: 'House #45, Street 12, Gulberg III, Lahore',
        problemDescription: 'Want to install 4 IP Dome Cameras with 1TB NVR and mobile live view setup.',
        urgency: 'Standard',
        status: 'In Progress',
        assignedTo: 'Engr. Zohaib (CCTV Tech)',
        assignedTechId: 'TECH-101',
        estimatedCost: 8500,
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        timeline: [
          { status: 'Pending', timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), note: 'Ticket booked online.' },
          { status: 'Assigned', timestamp: new Date(Date.now() - 3600000 * 3).toISOString(), note: 'Assigned to Engr. Zohaib.' },
          { status: 'In Progress', timestamp: new Date(Date.now() - 3600000 * 1).toISOString(), note: 'Technician on the way with Dahua 4K kit.' }
        ],
        notes: 'Technician on the way with Dahua 4K kit.'
      },
      {
        id: 'TKT-82911',
        customerName: 'Ayesha Khan',
        phone: '0321-9876543',
        serviceType: 'computer',
        serviceName: 'Computer & Laptop Repair',
        address: 'Office #204, Regent Plaza, Karachi',
        problemDescription: 'Dell Latitude laptop screen flickering and Windows blue screen crashing.',
        urgency: 'Emergency',
        status: 'Assigned',
        assignedTo: 'Hamza IT Specialist',
        assignedTechId: 'TECH-102',
        estimatedCost: 3500,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        timeline: [
          { status: 'Pending', timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), note: 'Ticket booked online.' },
          { status: 'Assigned', timestamp: new Date(Date.now() - 3600000 * 1).toISOString(), note: 'Assigned to Hamza IT Specialist.' }
        ],
        notes: 'Urgent office laptop. Diagnostics scheduled.'
      },
      {
        id: 'TKT-82912',
        customerName: 'Tariq Mahmood',
        phone: '0333-5554321',
        serviceType: 'electricity',
        serviceName: 'Electricity Problem & Wiring',
        address: 'Sector F-8/2, Islamabad',
        problemDescription: 'Main circuit breaker tripping repeatedly, master bedroom sockets sparked.',
        urgency: 'Emergency',
        status: 'Pending',
        assignedTo: null,
        assignedTechId: null,
        estimatedCost: 2000,
        createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
        timeline: [
          { status: 'Pending', timestamp: new Date(Date.now() - 3600000 * 1).toISOString(), note: 'Emergency ticket registered.' }
        ],
        notes: ''
      },
      {
        id: 'TKT-82913',
        customerName: 'Bilal Ahmed',
        phone: '0345-7778899',
        serviceType: 'printer',
        serviceName: 'Printer Problem & Repair',
        address: 'Shop 14, Commercial Market, Rawalpindi',
        problemDescription: 'HP LaserJet 1020 recurring paper jam and dirty vertical black streaks on printout.',
        urgency: 'Scheduled',
        status: 'Completed',
        assignedTo: 'Naveed Printer Expert',
        assignedTechId: 'TECH-104',
        estimatedCost: 2200,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        timeline: [
          { status: 'Pending', timestamp: new Date(Date.now() - 86400000).toISOString(), note: 'Created.' },
          { status: 'Assigned', timestamp: new Date(Date.now() - 80000000).toISOString(), note: 'Assigned to Naveed.' },
          { status: 'In Progress', timestamp: new Date(Date.now() - 70000000).toISOString(), note: 'Parts replacement.' },
          { status: 'Completed', timestamp: new Date(Date.now() - 50000000).toISOString(), note: 'Teflon sleeve replaced and toner drum cleaned. Tested OK.' }
        ],
        notes: 'Teflon sleeve replaced and toner drum cleaned. Tested OK.'
      }
    ],
    chats: {},
    inquiries: [
      {
        id: 'INQ-1001',
        name: 'Rashid Minhas',
        email: 'rashid@example.com',
        phone: '0300-9988776',
        subject: 'Corporate CCTV Contract',
        message: 'Looking for a maintenance contract for 32 cameras in our textile factory.',
        status: 'unread',
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
      }
    ],
    reviews: [
      {
        id: 'REV-501',
        ticketId: 'TKT-82913',
        customerName: 'Bilal Ahmed',
        serviceType: 'printer',
        rating: 5,
        comment: 'Super fast service! Naveed fixed our HP printer paper jam in less than an hour.',
        createdAt: new Date(Date.now() - 3600000 * 10).toISOString()
      }
    ]
  };
}

// Read database with validation and auto-healing
function readDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    dbCache = getInitialDb();
    saveDbSync(dbCache);
    return dbCache;
  }

  try {
    const stats = fs.statSync(DB_FILE);
    if (dbCache && stats.mtimeMs <= lastMtime) {
      return dbCache;
    }
    lastMtime = stats.mtimeMs;

    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const initial = getInitialDb();

    // Ensure all core top-level tables exist
    dbCache = {
      users: parsed.users || initial.users,
      services: parsed.services || initial.services,
      technicians: parsed.technicians || initial.technicians,
      tickets: parsed.tickets || initial.tickets,
      chats: parsed.chats || initial.chats,
      inquiries: parsed.inquiries || initial.inquiries,
      reviews: parsed.reviews || initial.reviews
    };

    // Ensure default admin and technicians exist in users table
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@proservice.com').toLowerCase();
    const adminExists = dbCache.users.some(u => u.email.toLowerCase() === adminEmail);
    if (!adminExists) {
      dbCache.users.unshift(initial.users[0]);
    }

    // Sync technicians into users if missing
    initial.users.slice(1).forEach(techUser => {
      const exists = dbCache.users.some(u => u.email.toLowerCase() === techUser.email.toLowerCase());
      if (!exists) {
        dbCache.users.push(techUser);
      }
    });

    saveDbSync(dbCache);

    return dbCache;
  } catch (err) {
    console.error('Error reading db.json, creating fresh backup:', err);
    dbCache = getInitialDb();
    saveDbSync(dbCache);
    return dbCache;
  }
}

// Thread-safe atomic file save
function saveDbSync(data) {
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
    try {
      lastMtime = fs.statSync(DB_FILE).mtimeMs;
    } catch (e) {}
  } catch (err) {
    console.error('Error saving db.json:', err);
  }
}

function saveDb(data) {
  dbCache = data;
  if (isWriting) {
    pendingSave = data;
    return;
  }

  isWriting = true;
  saveDbSync(data);
  isWriting = false;

  // Background sync to MongoDB if connected
  try {
    const { isMongoConnected, syncAllToMongo } = require('./mongoose');
    if (isMongoConnected()) {
      syncAllToMongo(data);
    }
  } catch (e) {}

  if (pendingSave) {
    const nextData = pendingSave;
    pendingSave = null;
    saveDb(nextData);
  }
}

module.exports = {
  readDb,
  saveDb,
  getInitialDb
};
