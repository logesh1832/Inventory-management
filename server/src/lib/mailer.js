// Nodemailer transporter for sending system emails
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendMail = ({ to, subject, html }) => {
  return transporter.sendMail({
    from: `"Inventory System" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = { sendMail };
