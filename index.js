/**
 * Portfolio Backend
 * Express + MongoDB contact API for Vercel and local development.
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const validator = require('validator');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const FRONTEND_URL = process.env.FRONTEND_URL;

app.set('trust proxy', 1);

app.use(cors({
  origin: FRONTEND_URL || true,
  methods: ['GET', 'POST'],
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many messages sent from this IP. Please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
      console.error('MongoDB connection failed:', err.message);
      console.log('Running without database. Messages will not be saved.');
    });
} else {
  console.log('MONGO_URI is not set. Running without database.');
}

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
      validator: value => validator.isEmail(value),
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

const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);

let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('Nodemailer configured. Email notifications enabled.');
}

function sanitize(value) {
  if (typeof value !== 'string') return '';
  return validator.escape(value.trim());
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

async function sendNotificationEmail(contact) {
  if (!transporter || !process.env.NOTIFY_EMAIL) return;

  const mailOptions = {
    from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFY_EMAIL,
    subject: `[Portfolio] New message from ${contact.name}`,
    html: `
      <div style="font-family: monospace; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #e8e8f0; padding: 32px; border-radius: 12px;">
        <h2 style="color: #00d4ff; margin-bottom: 24px;">New Portfolio Message</h2>
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
    console.log(`Notification email sent for message from ${contact.email}`);
  } catch (err) {
    console.error('Failed to send notification email:', err.message);
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

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

    const msgLower = message.toLowerCase();
    const spamKeywords = ['casino', 'buy now', 'click here', 'free money', 'earn $'];
    if (spamKeywords.some(keyword => msgLower.includes(keyword))) {
      return res.status(201).json({
        success: true,
        message: 'Message received! I\'ll get back to you soon.'
      });
    }

    const cleanData = {
      name: sanitize(name).substring(0, 80),
      email: validator.normalizeEmail(email) || email.toLowerCase(),
      subject: sanitize(subject || 'No subject').substring(0, 150),
      message: sanitize(message).substring(0, 2000),
      ipAddress: getClientIp(req)
    };

    let savedContact = null;
    if (MONGO_URI && mongoose.connection.readyState === 1) {
      const contact = new Contact(cleanData);
      savedContact = await contact.save();
      console.log(`New contact saved: ${cleanData.name} <${cleanData.email}>`);
    } else {
      console.log(`Contact received: ${cleanData.name} <${cleanData.email}>`);
    }

    if (transporter) {
      await sendNotificationEmail(savedContact || {
        ...cleanData,
        timestamp: new Date()
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Message received! I\'ll get back to you soon.',
      id: savedContact?._id || null
    });
  } catch (err) {
    console.error('Contact route error:', err.message);

    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ error: errors.join('. ') });
    }

    return res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'index.html'));

});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Contact API: POST http://localhost:${PORT}/api/contact`);
  });
}

module.exports = app;
