/**
 * System Constants & Initial Seed Data
 */

const ROLES = {
  ADMIN: 'admin',
  TECHNICIAN: 'technician',
  CUSTOMER: 'customer'
};

const TICKET_STATUSES = {
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

const URGENCY_LEVELS = {
  STANDARD: 'Standard',
  EMERGENCY: 'Emergency',
  SCHEDULED: 'Scheduled'
};

const DEFAULT_SERVICES = [
  {
    id: 'camera',
    title: 'Camera Installation (CCTV)',
    urduTitle: 'سی سی ٹی وی کیمرہ انسٹالیشن',
    icon: 'video',
    badge: 'High Security',
    shortDesc: 'Complete security camera setup, IP cameras, DVR/NVR configuration & mobile live-view access.',
    features: [
      'HD, 2K & 4K IP Camera Installation',
      'Night Vision & Motion Detection Cameras',
      'DVR / NVR Storage Setup & Cable Concealing',
      'Live Mobile App Viewing (Android & iOS)',
      'Maintenance, Repair & Relocation'
    ],
    startingPrice: 'Rs. 2,500',
    basePriceNum: 2500,
    turnaround: 'Same Day / 2-4 Hours',
    emergencyAvailable: true
  },
  {
    id: 'computer',
    title: 'Computer & Laptop Repair',
    urduTitle: 'کمپیوٹر اور لیپ ٹاپ ریپیئرنگ',
    icon: 'laptop',
    badge: 'Hardware & Software',
    shortDesc: 'Expert repair for laptops, desktops, gaming rigs, Mac & Windows. Hardware replacement & chip-level fix.',
    features: [
      'Windows & Mac OS Setup & Driver Installation',
      'SSD & RAM Speed Upgrade (Boot in 5s)',
      'Motherboard & Power IC Chip Repair',
      'Broken Screen, Battery & Keyboard Replacement',
      'Virus Removal & Lost Data Recovery'
    ],
    startingPrice: 'Rs. 1,500',
    basePriceNum: 1500,
    turnaround: '1-3 Hours / On-Site Available',
    emergencyAvailable: true
  },
  {
    id: 'electricity',
    title: 'Electricity Problem & Wiring',
    urduTitle: 'الیکٹریکل اور وائرنگ سروسز',
    icon: 'zap',
    badge: '24/7 Emergency',
    shortDesc: 'Certified electric emergency assistance. Fix short circuits, faulty breakers, wiring, UPS & inverter.',
    features: [
      '24/7 Emergency Short Circuit Diagnostics',
      'Complete Home & Commercial Concealed Wiring',
      'Distribution Box (DB) & Breaker Replacement',
      'UPS, Battery & Solar Inverter Wiring',
      'Ceiling Fans, SMD Lights & Appliance Connection'
    ],
    startingPrice: 'Rs. 1,200',
    basePriceNum: 1200,
    turnaround: 'Within 30-45 Minutes',
    emergencyAvailable: true
  },
  {
    id: 'printer',
    title: 'Printer Problem & Repair',
    urduTitle: 'پرنٹر ریپیئرنگ اور ٹونر ریفل',
    icon: 'printer',
    badge: 'All Major Brands',
    shortDesc: 'Fixing paper jams, faded prints, toner refilling, wireless network printing and driver errors.',
    features: [
      'Paper Jam & Roller Replacement',
      'Toner Refilling & Cartridge Chip Reset',
      'Printhead Deep Cleaning & Alignment',
      'Wi-Fi / Network Multi-PC Sharing Setup',
      'Motherboard, Power Supply & Sensor Fix'
    ],
    startingPrice: 'Rs. 1,000',
    basePriceNum: 1000,
    turnaround: 'Same Day Service',
    emergencyAvailable: false
  }
];

const DEFAULT_TECHNICIANS = [
  {
    id: 'TECH-101',
    name: 'Engr. Zohaib (CCTV Tech)',
    phone: '0301-1122334',
    email: 'zohaib@proservice.com',
    specialty: 'camera',
    specialtyLabel: 'Camera & CCTV Specialist',
    rating: 4.9,
    jobsCompleted: 142,
    status: 'available', // available, on-job, off-duty
    address: 'Lahore, Pakistan'
  },
  {
    id: 'TECH-102',
    name: 'Hamza IT Specialist',
    phone: '0322-4455667',
    email: 'hamza@proservice.com',
    specialty: 'computer',
    specialtyLabel: 'Computer & Laptop Expert',
    rating: 4.8,
    jobsCompleted: 198,
    status: 'available',
    address: 'Karachi, Pakistan'
  },
  {
    id: 'TECH-103',
    name: 'Ustad Aslam Electrician',
    phone: '0333-8899001',
    email: 'aslam@proservice.com',
    specialty: 'electricity',
    specialtyLabel: 'Certified Electrician (24/7)',
    rating: 5.0,
    jobsCompleted: 310,
    status: 'available',
    address: 'Islamabad / Rawalpindi, Pakistan'
  },
  {
    id: 'TECH-104',
    name: 'Naveed Printer Expert',
    phone: '0345-6677889',
    email: 'naveed@proservice.com',
    specialty: 'printer',
    specialtyLabel: 'Laser & Inkjet Printer Tech',
    rating: 4.7,
    jobsCompleted: 89,
    status: 'available',
    address: 'Rawalpindi, Pakistan'
  },
  {
    id: 'TECH-105',
    name: 'Engr. Salman (Camera & Network)',
    phone: '0300-5556677',
    email: 'salman@proservice.com',
    specialty: 'camera',
    specialtyLabel: 'IP Camera & NVR Specialist',
    rating: 4.9,
    jobsCompleted: 115,
    status: 'available',
    address: 'Lahore, Pakistan'
  }
];

module.exports = {
  ROLES,
  TICKET_STATUSES,
  URGENCY_LEVELS,
  DEFAULT_SERVICES,
  DEFAULT_TECHNICIANS
};
