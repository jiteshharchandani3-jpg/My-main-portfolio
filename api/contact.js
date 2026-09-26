require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

// Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const { name, email, subject, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({
        error: 'Name, email and message are required.'
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanSubject = subject?.trim() || 'No subject';
    const cleanMessage = message.trim();

    // ==========================================
    // 1. SAVE MESSAGE TO SUPABASE
    // ==========================================

    const { data, error } = await supabase
      .from('contact_messages')
      .insert([
        {
          name: cleanName,
          email: cleanEmail,
          subject: cleanSubject,
          message: cleanMessage
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase Error:', error);

      return res.status(500).json({
        error: error.message
      });
    }

    // ==========================================
    // 2. SEND THANK-YOU EMAIL TO VISITOR
    // ==========================================

    await transporter.sendMail({
      from: `"Jitesh Harchandani" <${process.env.GMAIL_USER}>`,
      to: cleanEmail,
      subject: 'Thank you for your inquiry',
      html: `
        <div style="
          font-family: Arial, sans-serif;
          line-height: 1.6;
          max-width: 600px;
          margin: auto;
          padding: 20px;
        ">
          <h2>Thank you, ${cleanName}!</h2>

          <p>
            Thanks for your inquiry. I have received your message
            and will get back to you soon.
          </p>

          <hr>

          <p>
            <strong>Subject:</strong> ${cleanSubject}
          </p>

          <p>
            Thank you for reaching out through my portfolio website.
          </p>

          <p>
            Best regards,<br>
            <strong>Jitesh Harchandani</strong>
          </p>
        </div>
      `
    });

    // ==========================================
    // 3. SEND NOTIFICATION EMAIL TO JITESH
    // ==========================================

    await transporter.sendMail({
      from: `"Portfolio Website" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: cleanEmail,
      subject: `New Portfolio Inquiry: ${cleanSubject}`,
      html: `
        <div style="
          font-family: Arial, sans-serif;
          line-height: 1.6;
          max-width: 650px;
          margin: auto;
          padding: 20px;
        ">
          <h2>🔔 New Website Inquiry</h2>

          <p>
            Someone has submitted an inquiry through your portfolio website.
          </p>

          <hr>

          <p>
            <strong>Name:</strong> ${cleanName}
          </p>

          <p>
            <strong>Email:</strong> ${cleanEmail}
          </p>

          <p>
            <strong>Subject:</strong> ${cleanSubject}
          </p>

          <p>
            <strong>Message:</strong>
          </p>

          <div style="
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            white-space: pre-wrap;
          ">
            ${cleanMessage}
          </div>

          <hr>

          <p>
            You can simply click <strong>Reply</strong> to respond
            directly to the person who submitted this inquiry.
          </p>

          <p>
            <strong>Jitesh Harchandani</strong><br>
            Portfolio Website
          </p>
        </div>
      `
    });

    // ==========================================
    // 4. RETURN SUCCESS
    // ==========================================

    return res.status(200).json({
      success: true,
      message: 'Message saved and both emails sent successfully!',
      data
    });

  } catch (error) {
    console.error('Server Error:', error);

    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
};