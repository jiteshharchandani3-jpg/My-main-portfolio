require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const validator = require('validator');

// -----------------------------
// Supabase
// -----------------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// -----------------------------
// Sanitize input
// -----------------------------
function sanitize(value) {
  if (typeof value !== 'string') return '';
  return validator.escape(value.trim());
}

// -----------------------------
// Send email notification
// -----------------------------
async function sendEmailNotification(contact) {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.NOTIFY_EMAIL
  ) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
    to: process.env.NOTIFY_EMAIL,
    subject: `[Portfolio] New message from ${contact.name}`,
    html: `
      <h2>New portfolio message</h2>

      <p><strong>Name:</strong> ${contact.name}</p>

      <p><strong>Email:</strong> ${contact.email}</p>

      <p><strong>Subject:</strong> ${contact.subject}</p>

      <p><strong>Message:</strong></p>

      <p>${contact.message.replace(/\n/g, '<br>')}</p>
    `
  });
}

// -----------------------------
// API Handler
// -----------------------------
module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    // Check Supabase configuration
    if (!supabase) {
      console.error('Supabase environment variables are missing.');

      return res.status(500).json({
        error: 'Server configuration error.'
      });
    }

    const {
      name,
      email,
      subject,
      message
    } = req.body || {};

    // -----------------------------
    // Validation
    // -----------------------------
    if (!name || !email || !message) {
      return res.status(400).json({
        error: 'Name, email, and message are required.'
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        error: 'Please enter a valid email address.'
      });
    }

    if (message.trim().length < 10) {
      return res.status(400).json({
        error: 'Message must be at least 10 characters.'
      });
    }

    // -----------------------------
    // Prepare Supabase payload
    // -----------------------------
    const payload = {
      name: sanitize(name).slice(0, 80),
      email:
        validator.normalizeEmail(email) ||
        email.toLowerCase(),
      subject: sanitize(subject || 'No subject').slice(0, 150),
      message: sanitize(message).slice(0, 2000),
      ip_address:
        req.headers['x-forwarded-for'] ||
        req.socket?.remoteAddress ||
        'unknown'
    };

    // -----------------------------
    // Save to Supabase
    // -----------------------------
    const { data, error } = await supabase
      .from('contact_messages')
      .insert([payload])
      .select('id')
      .single();

    if (error) {
      console.error('Supabase Insert Error:', error);

      return res.status(500).json({
        error: 'Unable to save your message. Please try again later.'
      });
    }

    // -----------------------------
    // Send email notification
    // -----------------------------
    sendEmailNotification(payload).catch((emailError) => {
      console.error('Email Notification Error:', emailError);
    });

    // -----------------------------
    // Success response
    // -----------------------------
    return res.status(201).json({
      success: true,
      message: "Message received! I'll get back to you soon.",
      id: data?.id || null,
      storage: 'supabase'
    });

  } catch (error) {
    console.error('Contact Handler Error:', error);

    return res.status(500).json({
      error: 'Internal server error. Please try again later.'
    });
  }
};