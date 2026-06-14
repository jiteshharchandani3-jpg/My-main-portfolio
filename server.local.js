/**
 * ============================================================
 *  Portfolio Backend — server/index.js
 *  Node.js + Express + MongoDB
 *  Handles contact form submissions with rate limiting & validation
 * ============================================================
 */

require('dotenv').config();

const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const nodemailer = require('nodemailer');
const validator  = require('validator');

const app  = express();
const PORT = process.env.PORT || 5000;

/* ============================================================
   MIDDLEWARE
============================================================ */

// CORS — allow your frontend origin
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
  optionsSuccessStatus: 200
}));

// Parse JSON bodies
app.use(express.json({ limit: '10kb' }));

// Helmet-lite: basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

/* ============================================================
   RATE LIMITING
   Max 5 contact form submissions per IP per hour
============================================================ */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    error: 'Too many messages sent from this IP. Please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/* ============================================================
   MONGODB CONNECTION
============================================================ */
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/portfolio';

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅  MongoDB connected successfully'))
  .catch(err => {
    console.error('❌  MongoDB connection failed:', err.message);
    console.log('    Running without database (messages will not be saved).');
  });

/* ============================================================
   DATABASE SCHEMA & MODEL
============================================================ */

/**
 * ContactMessage Schema
 * Fields: name, email, subject, message, timestamp, ipAddress, read
 */
const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [80, 'Name cannot exceed 80 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    validate: {
      validator: (v) => validator.isEmail(v),
      message: 'Invalid email address'
    }
  },
  subject: {
    type: String,
    trim: true,
    maxlength: [150, 'Subject cannot exceed 150 characters'],
    default: 'No subject'
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    minlength: [10, 'Message must be at least 10 characters'],
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  ipAddress: {
    type: String,
    default: 'unknown'
  },
  read: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Contact = mongoose.model('Contact', contactSchema);

/* ============================================================
   EMAIL TRANSPORTER (optional — Nodemailer)
   Set SMTP_* env vars to enable email notifications
============================================================ */
let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('📧  Nodemailer configured — email notifications enabled');
}

/**
 * Send notification email to portfolio owner
 */
async function sendNotificationEmail(contact) {
  if (!transporter || !process.env.NOTIFY_EMAIL) return;

  const mailOptions = {
    from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFY_EMAIL,
    subject: `[Portfolio] New message from ${contact.name}`,
    html: `
      <div style="font-family: monospace; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #e8e8f0; padding: 32px; border-radius: 12px;">
        <h2 style="color: #00d4ff; margin-bottom: 24px;">📬 New Portfolio Message</h2>
        <table style="width:100%; border-collapse:collapse;">
          <tr><td style="padding:8px 0; color:#9090a8; width:100px;">From:</td><td style="color:#e8e8f0;">${contact.name}</td></tr>
          <tr><td style="padding:8px 0; color:#9090a8;">Email:</td><td><a href="mailto:${contact.email}" style="color:#00d4ff;">${contact.email}</a></td></tr>
          <tr><td style="padding:8px 0; color:#9090a8;">Subject:</td><td style="color:#e8e8f0;">${contact.subject}</td></tr>
          <tr><td style="padding:8px 0; color:#9090a8;">Time:</td><td style="color:#e8e8f0;">${new Date(contact.timestamp).toLocaleString()}</td></tr>
        </table>
        <div style="margin-top:24px; padding:20px; background:#1a1a24; border-radius:8px; border-left:3px solid #00d4ff;">
          <p style="color:#9090a8; margin:0 0 8px 0; font-size:12px; text-transform:uppercase; letter-spacing:0.1em;">Message</p>
          <p style="margin:0; line-height:1.7;">${contact.message.replace(/\n/g, '<br>')}</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧  Notification email sent for message from ${contact.email}`);
  } catch (err) {
    console.error('📧  Failed to send notification email:', err.message);
  }
}

/* ============================================================
   UTILITY — sanitize text to prevent XSS
============================================================ */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return validator.escape(str.trim());
}

/* ============================================================
   ROUTES
============================================================ */

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

/**
 * POST /api/contact
 * Save contact form submission + send email notification
 *
 * Body: { name, email, subject?, message }
 * Response: { success, message, id }
 */
app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    /* ---------- Input validation ---------- */
    if (!name || !email || !message) {
      return res.status(400).json({
        error: 'Name, email, and message are required fields.'
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (typeof message !== 'string' || message.trim().length < 10) {
      return res.status(400).json({ error: 'Message must be at least 10 characters long.' });
    }

    /* ---------- Spam heuristics ---------- */
    const msgLower = message.toLowerCase();
    const spamKeywords = ['casino', 'buy now', 'click here', 'free money', 'earn $'];
    if (spamKeywords.some(k => msgLower.includes(k))) {
      // Silently accept but don't save (honeypot behavior)
      return res.status(201).json({
        success: true,
        message: 'Message received! I\'ll get back to you soon.'
      });
    }

    /* ---------- Sanitize inputs ---------- */
    const cleanData = {
      name:      sanitize(name).substring(0, 80),
      email:     validator.normalizeEmail(email) || email.toLowerCase(),
      subject:   sanitize(subject || 'No subject').substring(0, 150),
      message:   sanitize(message).substring(0, 2000),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown'
    };

    /* ---------- Save to MongoDB ---------- */
    let savedContact = null;
    if (mongoose.connection.readyState === 1) {
      const contact = new Contact(cleanData);
      savedContact = await contact.save();
      console.log(`💬  New contact saved: ${cleanData.name} <${cleanData.email}>`);
    } else {
      console.log(`💬  (DB offline) Contact from: ${cleanData.name} <${cleanData.email}>`);
    }

    /* ---------- Send notification email ---------- */
    if (savedContact) {
      sendNotificationEmail(savedContact); // non-blocking
    }

    res.status(201).json({
      success: true,
      message: 'Message received! I\'ll get back to you soon.',
      id: savedContact?._id || null
    });

  } catch (err) {
    console.error('❌  Contact route error:', err.message);

    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ error: errors.join('. ') });
    }

    res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
});

/* ============================================================
   404 handler
============================================================ */
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

/* ============================================================
   Global error handler
============================================================ */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong.' });
});

/* ============================================================
   START SERVER
============================================================ */
app.listen(PORT, () => {
  console.log(`\n🚀  Server running on http://localhost:${PORT}`);
  console.log(`📋  Health check: http://localhost:${PORT}/api/health`);
  console.log(`📮  Contact API: POST http://localhost:${PORT}/api/contact\n`);
});
