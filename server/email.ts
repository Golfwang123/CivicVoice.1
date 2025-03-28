import nodemailer from 'nodemailer';

// Email configuration using environment variables with fallbacks
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || 'dummy_user',
    pass: process.env.EMAIL_PASSWORD || 'dummy_password'
  }
};

// Create reusable transporter using SMTP transport
const transporter = nodemailer.createTransport(emailConfig);

// For development, we'll simulate email sending by default
const SIMULATE_EMAIL_SENDING = process.env.NODE_ENV !== 'production' || !process.env.EMAIL_HOST;

/**
 * Send an email using either real SMTP or simulated email sending
 */
export async function sendEmail(options: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  senderName?: string;
}): Promise<{ success: boolean; message: string }> {
  const { from, to, subject, text, html, senderName } = options;
  
  try {
    if (SIMULATE_EMAIL_SENDING) {
      // Just log the email content to console for development purposes
      console.log('\n--- EMAIL WOULD BE SENT ---');
      console.log(`From: ${senderName ? `${senderName} <${from}>` : from}`);
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`\nBody:\n${text}`);
      console.log('--- END OF EMAIL ---\n');
      
      return { success: true, message: 'Email simulation successful' };
    } else {
      // Actually send the email in production
      const mailOptions = {
        from: senderName ? `${senderName} <${from}>` : from,
        to: to,
        subject: subject,
        text: text,
        html: html || text.replace(/\n/g, '<br>')
      };
      
      await transporter.sendMail(mailOptions);
      return { success: true, message: 'Email sent successfully' };
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return { 
      success: false, 
      message: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Normalize an email address from a user input
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  
  // Basic email validation and normalization
  email = email.trim().toLowerCase();
  
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return null; // Invalid email format
  }
  
  return email;
}
