const { google } = require('googleapis');
const User = require('../models/User.js');
const Resume = require('../models/Resume.js');

async function sendUserEmail(oauth2Client, userId, to, subject, message) {
  try {
    console.log(`[Email Service] Starting email process for user: ${userId}`);
    
    const resume = await Resume.findOne({ user: userId }).sort({ createdAt: -1 });
    if (!resume) {
      throw new Error('No resume found for this user. Please upload a resume first.');
    }
    // Add a specific check for the PDF data itself
    if (!resume.pdf || resume.pdf.length === 0) {
      console.error(`[Email Service] Found resume record for user ${userId} (ID: ${resume._id}), but it contains no PDF data.`);
      throw new Error('The most recent resume record is incomplete. Please re-upload your resume.');
    }
    console.log(`[Email Service] Resume found for user: ${userId} (ID: ${resume._id})`);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    console.log('[Email Service] Gmail client created.');

    const boundary = `email_boundary_${Date.now()}`;
    const mailParts = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      message,
      '',
      `--${boundary}`,
      'Content-Type: application/pdf',
      'Content-Transfer-Encoding: base64',
      'Content-Disposition: attachment; filename="resume.pdf"',
      '',
      resume.pdf.toString('base64'),
      '',
      `--${boundary}--`
    ];

    const rawMessage = Buffer.from(mailParts.join('\r\n'), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+\$/, '');

    console.log('[Email Service] Sending email via Gmail API...');
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
      },
    });

    console.log(`[Email Service] Email sent successfully for user: ${userId}`);
    return result.data;

  } catch (error) {
    console.error(`[Email Service] Email sending failed for user ${userId}:`, error.message);
    
    if (error.code === 401 || error.message.includes('invalid_grant')) {
      throw new Error('Gmail authentication failed. Please reconnect your Gmail account.');
    } else if (error.code === 403) {
      throw new Error('Gmail API access denied. Check your OAuth scopes and permissions.');
    } else if (error.code === 400) {
      throw new Error('Invalid email format or content. Please check recipient email and message.');
    }
    
    throw error;
  }
}

module.exports = { sendUserEmail };