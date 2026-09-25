require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

const resend = new Resend(process.env.RESEND_API_KEY);

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

    const visitorEmail = await resend.emails.send({
      from: 'Portfolio <onboarding@resend.dev>',
      to: [cleanEmail],
      subject: 'Thank you for your inquiry',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Thank you, ${cleanName}!</h2>

          <p>
            Thanks for your inquiry. I have received your message
            and will get back to you soon.
          </p>

          <hr>

          <p><strong>Subject:</strong> ${cleanSubject}</p>

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

    if (visitorEmail.error) {
      console.error('Visitor Email Error:', visitorEmail.error);
    }

    // ==========================================
    // 3. SEND NOTIFICATION EMAIL TO YOU
    // ==========================================

    const notificationEmail = await resend.emails.send({
      from: 'Portfolio <onboarding@resend.dev>',
      to: ['jiteshharchandani3@gmail.com'],
      subject: `New Portfolio Inquiry: ${cleanSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>New Portfolio Inquiry</h2>

          <p><strong>Name:</strong> ${cleanName}</p>

          <p><strong>Email:</strong> ${cleanEmail}</p>

          <p><strong>Subject:</strong> ${cleanSubject}</p>

          <p><strong>Message:</strong></p>

          <div style="
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
          ">
            ${cleanMessage}
          </div>

          <hr>

          <p>
            This message was submitted through your portfolio website.
          </p>
        </div>
      `
    });

    if (notificationEmail.error) {
      console.error(
        'Notification Email Error:',
        notificationEmail.error
      );
    }

    // ==========================================
    // 4. RETURN SUCCESS
    // ==========================================

    return res.status(200).json({
      success: true,
      message: 'Message saved and emails processed successfully!',
      data
    });

  } catch (error) {
    console.error('Server Error:', error);

    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
};