import nodemailer from 'nodemailer';

/**
 * Creates a reusable nodemailer transporter using Gmail App Password credentials.
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Sends a password reset email with a secure link.
 * @param {string} toEmail  - Recipient email address
 * @param {string} resetLink - The full reset URL with token
 * @param {string} userName  - Optional display name
 */
export const sendPasswordResetEmail = async (toEmail, resetLink, userName = 'User') => {
  const transporter = createTransporter();

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reset Your Password</title>
      </head>
      <body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#14b8a6,#06b6d4);padding:32px 40px;text-align:center;">
                    <div style="display:inline-block;background:rgba(0,0,0,0.2);border-radius:12px;padding:8px 20px;">
                      <span style="color:#000;font-size:22px;font-weight:800;letter-spacing:-0.5px;">HRMS Platform</span>
                    </div>
                    <p style="color:rgba(0,0,0,0.7);margin:8px 0 0;font-size:13px;font-weight:600;">Password Reset Request</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px;">
                    <p style="color:#94a3b8;font-size:14px;margin:0 0 8px;">Hi <strong style="color:#e2e8f0;">${userName}</strong>,</p>
                    <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;line-height:1.7;">
                      We received a request to reset your HRMS account password. Click the button below to set a new password. This link is valid for <strong style="color:#e2e8f0;">15 minutes</strong>.
                    </p>

                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding:8px 0 32px;">
                          <a href="${resetLink}" 
                             style="display:inline-block;background:linear-gradient(135deg,#14b8a6,#06b6d4);color:#000;font-size:14px;font-weight:800;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.3px;">
                            Reset My Password
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Fallback link -->
                    <p style="color:#64748b;font-size:12px;margin:0 0 6px;">If the button doesn't work, copy and paste this link into your browser:</p>
                    <p style="margin:0 0 28px;">
                      <a href="${resetLink}" style="color:#14b8a6;font-size:11px;word-break:break-all;text-decoration:none;">${resetLink}</a>
                    </p>

                    <!-- Warning -->
                    <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:16px 20px;">
                      <p style="color:#f59e0b;font-size:12px;font-weight:700;margin:0 0 4px;">⚠ Didn't request this?</p>
                      <p style="color:#64748b;font-size:12px;margin:0;line-height:1.6;">
                        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged and the link will expire automatically.
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="border-top:1px solid #334155;padding:20px 40px;text-align:center;">
                    <p style="color:#475569;font-size:11px;margin:0;">
                      This email was sent by <strong>HRMS Platform</strong>. Do not reply to this email.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const mailOptions = {
    from: `"HRMS Platform" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: '🔐 Reset Your HRMS Password — Link expires in 15 minutes',
    html: htmlBody,
    text: `Hi ${userName},\n\nYou requested a password reset for your HRMS account.\n\nClick here to reset your password (valid 15 minutes):\n${resetLink}\n\nIf you did not request this, please ignore this email.\n\n— HRMS Platform`,
  };

  await transporter.sendMail(mailOptions);
  console.log(`[EMAIL] Password reset email sent to ${toEmail}`);
};
