const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const validator = require('validator');

const MONGO_URI = process.env.MONGO_URI;

let mongoPromise = null;
let transporter = null;

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

function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function setCors(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.FRONTEND_URL || origin || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
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
  return req.socket?.remoteAddress || 'unknown';
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

async function connectMongo() {
  if (!MONGO_URI) return false;
  if (mongoose.connection.readyState === 1) return true;

  if (!mongoPromise) {
    mongoPromise = mongoose.connect(MONGO_URI).then(() => true);
  }

  await mongoPromise;
  return mongoose.connection.readyState === 1;
}

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
}

async function sendNotificationEmail(contact) {
  const mailer = getTransporter();
  if (!mailer || !process.env.NOTIFY_EMAIL) return;

  try {
    await mailer.sendMail({
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
    });
  } catch (err) {
    console.error('Failed to send notification email:', err.message);
  }
}

async function handleContact(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const { name, email, subject, message } = await readJsonBody(req);

    if (!name || !email || !message) {
      json(res, 400, { error: 'Name, email, and message are required fields.' });
      return;
    }

    if (!validator.isEmail(email)) {
      json(res, 400, { error: 'Please provide a valid email address.' });
      return;
    }

    if (typeof message !== 'string' || message.trim().length < 10) {
      json(res, 400, { error: 'Message must be at least 10 characters long.' });
      return;
    }

    const msgLower = message.toLowerCase();
    const spamKeywords = ['casino', 'buy now', 'click here', 'free money', 'earn $'];
    if (spamKeywords.some(keyword => msgLower.includes(keyword))) {
      json(res, 201, {
        success: true,
        message: 'Message received! I\'ll get back to you soon.'
      });
      return;
    }

    const cleanData = {
      name: sanitize(name).substring(0, 80),
      email: validator.normalizeEmail(email) || email.toLowerCase(),
      subject: sanitize(subject || 'No subject').substring(0, 150),
      message: sanitize(message).substring(0, 2000),
      ipAddress: getClientIp(req)
    };

    let savedContact = null;

    if (await connectMongo()) {
      savedContact = await new Contact(cleanData).save();
    }

    await sendNotificationEmail(savedContact || {
      ...cleanData,
      timestamp: new Date()
    });

    json(res, 201, {
      success: true,
      message: 'Message received! I\'ll get back to you soon.',
      id: savedContact?._id || null
    });
  } catch (err) {
    console.error('Contact API error:', err);

    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      json(res, 400, { error: errors.join('. ') });
      return;
    }

    if (err instanceof SyntaxError) {
      json(res, 400, { error: 'Invalid JSON body.' });
      return;
    }

    json(res, 500, { error: 'Internal server error. Please try again later.' });
  }
}

function handleHealth(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  json(res, 200, {
    status: 'ok',
    timestamp: new Date(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
}

module.exports = {
  handleContact,
  handleHealth,
  json,
  setCors
};