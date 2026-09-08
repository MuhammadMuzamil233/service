const { readDb } = require('../config/db');

/**
 * Intelligent Bilingual Chatbot Response Engine
 * Understands Urdu (Roman) & English intents
 */
function analyzeBotResponse(userMsg, session) {
  const msg = (userMsg || '').toLowerCase().trim();

  // 1. Check if requesting live human agent
  if (
    msg.includes('agent') || 
    msg.includes('human') || 
    msg.includes('rabata') || 
    msg.includes('rabta') ||
    msg.includes('call') || 
    msg.includes('talk to someone') ||
    msg.includes('banda') || 
    msg.includes('admin') ||
    msg.includes('insan') ||
    msg.includes('live support') ||
    msg.includes('representative')
  ) {
    return {
      type: 'agent_handoff',
      text: "Bilkul! Hum aapko humare Live Support Agent se connect kar rahe hain. Please 1 minute intezar karein, hamara representative abhi aap se rabta karega.",
      quickReplies: ['Cancel Agent', 'Call Helpline 0300-9998877', 'Main Menu']
    };
  }

  // 2. Greetings
  if (msg.match(/^(hi|hello|hey|salam|asalam|aoa|kese ho|kia hal|kaise ho|greetings)/i)) {
    return {
      type: 'greeting',
      text: "Assalam-o-Alaikum! 🌟 Welcome to ProService Support! Mai aapki kis tarah madad kar sakta hoon?\n\nHumari core services:\n1️⃣ 📹 Camera Installation (CCTV)\n2️⃣ 💻 Computer & Laptop Repair\n3️⃣ ⚡ Electricity Problem (Bijli ka Masla)\n4️⃣ 🖨️ Printer Problem & Toner\n\nAap niche button se select kar sakte hain ya apna masla likh kar bata sakte hain.",
      quickReplies: ['📹 Camera Installation', '💻 Computer Repair', '⚡ Electricity Problem', '🖨️ Printer Problem', '🎫 Track My Ticket', '👨‍💼 Talk to Agent']
    };
  }

  // 3. Camera Installation queries
  if (
    msg.includes('camera') || 
    msg.includes('cctv') || 
    msg.includes('dvr') || 
    msg.includes('nvr') || 
    msg.includes('surveillance') ||
    msg.includes('security camera') ||
    msg.includes('hikvision') ||
    msg.includes('dahua')
  ) {
    return {
      type: 'service_camera',
      text: "📹 **CCTV & Camera Installation Services**:\n\n• HD, 2K & 4K IP Camera Setup\n• Night Vision & ColorVu Cameras\n• Mobile App Live-View configuration\n• DVR/NVR Hard Drive Storage Setup\n• Home, Shop, Warehouse & Office installations\n\n💰 **Starting Price**: Rs. 2,500 (Wiring & Installation)\n⏱️ **Availability**: Same day technician visit available.\n\nKya aap camera lagwana chahte hain ya quotation chahiye?",
      quickReplies: ['Book Camera Service', 'Camera Prices', 'Talk to CCTV Tech', 'Main Menu']
    };
  }

  // 4. Computer Repair queries
  if (
    msg.includes('computer') || 
    msg.includes('laptop') || 
    msg.includes('pc') || 
    msg.includes('windows') || 
    msg.includes('mac') || 
    msg.includes('macbook') ||
    msg.includes('slow') || 
    msg.includes('screen') || 
    msg.includes('ssd') ||
    msg.includes('ram') ||
    msg.includes('virus') ||
    msg.includes('display') ||
    msg.includes('hang')
  ) {
    return {
      type: 'service_computer',
      text: "💻 **Computer & Laptop Repair Services**:\n\n• Windows/Mac OS installation & virus cleaning\n• Laptop Screen, Keyboard & Battery replacement\n• SSD Upgrade (Aapka laptop 10x fast ho jayega)\n• Motherboard, Power IC & chip level repair\n• Data Recovery from damaged hard drives\n\n💰 **Starting Diagnostics**: Rs. 1,500\n🏡 **Doorstep / Pick & Drop service** available!",
      quickReplies: ['Book Laptop Repair', 'SSD Upgrade Price', 'Talk to IT Expert', 'Main Menu']
    };
  }

  // 5. Electricity queries
  if (
    msg.includes('electric') || 
    msg.includes('bijli') || 
    msg.includes('wiring') || 
    msg.includes('short circuit') || 
    msg.includes('breaker') || 
    msg.includes('ups') || 
    msg.includes('solar') || 
    msg.includes('light') || 
    msg.includes('fan') ||
    msg.includes('spark') ||
    msg.includes('tripping')
  ) {
    return {
      type: 'service_electricity',
      text: "⚡ **Electricity Problem & 24/7 Emergency Support**:\n\n• Short circuit diagnostics & immediate emergency fix\n• Main DB Breaker tripping problem\n• Complete home & commercial concealed wiring\n• UPS & Solar Inverter connections\n• Switchboard, lights & heavy load wiring\n\n🚨 **Emergency Response**: 30-45 minutes me electrician aapke ghar pohnch sakta hai!\n💰 **Starting Cost**: Rs. 1,200",
      quickReplies: ['🚨 Emergency Electrician', 'Book Wiring Work', 'UPS Setup Help', 'Main Menu']
    };
  }

  // 6. Printer queries
  if (
    msg.includes('printer') || 
    msg.includes('toner') || 
    msg.includes('cartridge') || 
    msg.includes('paper jam') || 
    msg.includes('hp') || 
    msg.includes('canon') || 
    msg.includes('epson') ||
    msg.includes('print nahi') ||
    msg.includes('printhead')
  ) {
    return {
      type: 'service_printer',
      text: "🖨️ **Printer Repair & Maintenance Services**:\n\n• Paper Jam & Paper Feed Roller repair\n• Toner Refilling & Drum cleaning\n• Wi-Fi / LAN Network Printer Sharing setup\n• Print Head Cleaning (Faded / Blank lines fix)\n• HP, Canon, Epson & Brother hardware repair\n\n💰 **Starting Price**: Rs. 1,000\n🚀 On-site visit & workshop service available.",
      quickReplies: ['Book Printer Repair', 'Toner Refill Info', 'Talk to Printer Tech', 'Main Menu']
    };
  }

  // 7. Ticket tracking query
  if (msg.includes('track') || msg.includes('status') || msg.includes('ticket') || msg.includes('tkt-')) {
    const foundMatch = msg.match(/tkt-\d{5}/i);
    if (foundMatch) {
      const ticketId = foundMatch[0].toUpperCase();
      const db = readDb();
      const ticket = (db.tickets || []).find(t => t.id === ticketId);
      if (ticket) {
        return {
          type: 'ticket_status',
          text: `🎫 **Ticket Details (${ticket.id})**:\n• **Customer**: ${ticket.customerName}\n• **Service**: ${ticket.serviceName}\n• **Status**: ${ticket.status.toUpperCase()}\n• **Assigned Tech**: ${ticket.assignedTo || 'Assigning soon'}\n• **Notes**: ${ticket.notes || 'Under review'}`,
          quickReplies: ['Book Another Service', 'Talk to Agent', 'Main Menu']
        };
      } else {
        return {
          type: 'ticket_not_found',
          text: `Ticket **${ticketId}** nahi mila. Baraye mehrbani apna sahi Ticket Number check karein (Maslan: TKT-82910).`,
          quickReplies: ['View Services', 'Talk to Agent', 'Main Menu']
        };
      }
    }
    return {
      type: 'track_prompt',
      text: "Aap apne ticket ka status maloom karne ke liye apna Ticket ID yahan likhein (Maslan: `TKT-82910`) ya website ke 'Track Status' button par click karein.",
      quickReplies: ['TKT-82910', 'Book New Service', 'Main Menu']
    };
  }

  // 8. Booking intent in chat
  if (msg.includes('book') || msg.includes('service chahiye') || msg.includes('order') || msg.includes('technician bhejo') || msg.includes('appointment')) {
    return {
      type: 'booking_intent',
      text: "Zaroor! Aap 2 tareeqon se service book kar sakte hain:\n\n1. Website par **'Book Service'** button click karke form fill karein.\n2. Ya yahan chat me apna **Naam, Phone, Address aur Masla** likh kar bhej dein, hum foran ticket create kar denge!",
      quickReplies: ['📹 Book Camera', '💻 Book Computer', '⚡ Book Electrician', '🖨️ Book Printer']
    };
  }

  // 9. Pricing inquiries
  if (msg.includes('price') || msg.includes('rate') || msg.includes('cost') || msg.includes('kitna') || msg.includes('charges') || msg.includes('pese')) {
    return {
      type: 'pricing',
      text: "💵 **Estimated Rates / Prices**:\n\n• 📹 Camera Installation: Starting Rs. 2,500\n• 💻 Computer / Laptop Repair: Starting Rs. 1,500\n• ⚡ Electrical Emergency: Starting Rs. 1,200\n• 🖨️ Printer Repair / Toner: Starting Rs. 1,000\n\n*Note: Final cost maslay aur replacement parts par depend karti hai.*",
      quickReplies: ['Book Service', 'Talk to Agent', 'Main Menu']
    };
  }

  // 10. Thanks / Closing
  if (msg.includes('shukriya') || msg.includes('thanks') || msg.includes('thank you') || msg.includes('meherbani') || msg.includes('jazakallah')) {
    return {
      type: 'thanks',
      text: "Aapka bohat shukriya! ProService par aane ka shukriya. Agar mazeed koi madad chahiye ho toh hum hamesha hazir hain! Have a great day! 😊",
      quickReplies: ['Main Menu', 'Talk to Agent', 'Track Ticket']
    };
  }

  // 11. Default fallback response
  return {
    type: 'fallback',
    text: "Shukriya! Mai aapka sawal samajh raha hoon. Kya aap Camera, Computer, Electricity, ya Printer service ke baray me janana chahte hain?\n\nAap niche diye gaye options me se chun sakte hain ya humare **Live Agent** se direct baat kar sakte hain.",
    quickReplies: ['📹 Camera Installation', '💻 Computer Repair', '⚡ Electricity Problem', '🖨️ Printer Problem', '👨‍💼 Talk to Live Agent']
  };
}

module.exports = {
  analyzeBotResponse
};
