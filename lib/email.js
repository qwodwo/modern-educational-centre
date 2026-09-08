'use strict';

const CONFIG = require('../config/config.json');
const SAT = CONFIG.email || {};

let transporter = null;
let attemptedLoad = false;

function getTransporter() {
  if (attemptedLoad) return transporter;
  attemptedLoad = true;
  if (!SAT.gmailUser || !SAT.gmailAppPassword) {
    console.warn('[email] Not configured - set gmailUser/gmailAppPassword in config/config.json to enable email.');
    return null;
  }
  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: SAT.gmailUser, pass: SAT.gmailAppPassword }
    });
    console.log('[email] Gmail SMTP configured');
  } catch (err) {
    console.warn('[email] nodemailer not installed - run "npm install"; email disabled.');
    transporter = null;
  }
  return transporter;
}

function isEnabled(trans) {
  return !!trans;
}

function sendMail({ to, subject, text, html }) {
  const trans = getTransporter();
  if (!isEnabled(trans)) return Promise.resolve(false);
  return trans
    .sendMail({ from: SAT.from || SAT.gmailUser, to, subject, text, html })
    .then(() => {
      console.log('[email] sent to ' + to + ' - ' + subject);
      return true;
    })
    .catch((err) => {
      console.error('[email] send failed: ' + err.message);
      return false;
    });
}

const SITE_NAME = (CONFIG.site && CONFIG.site.name) || 'Modern Educational Centre';

function applicationReceived(application, recipients) {
  const text =
    'New "Application Received" notification.\n\n' +
    'Ref: ' + application.ref + '\n' +
    'Student: ' + application.studentName + '\n' +
    'Level: ' + application.gradeLevel + '\n' +
    'Stream: ' + application.stream + '\n' +
    'Guardian: ' + application.guardianName + ' (' + application.guardianEmail + ')\n\n' +
    'The application has been received and logged in the admission queue.';
  return sendMail({
    to: recipients.join(', '),
    subject: '[' + application.ref + '] Application Received - ' + SITE_NAME,
    text
  });
}

function applicationDecided(application) {
  const status = application.status;
  const approved = status === 'approved';
  const text =
    'Your application for ' + application.studentName + ' has been ' + status.toUpperCase() + '.\n\n' +
    'Application ref: ' + application.ref + '\n' +
    (approved
      ? 'Congratulations! You can proceed with fee payment via your Parent Portal or by contacting the school office.'
      : status === 'rejected'
        ? 'You may contact the school office for further details.'
        : 'Our team will be in touch soon.');
  return sendMail({
    to: application.guardianEmail,
    subject: '[' + application.ref + '] Application ' + status.toUpperCase() + ' - ' + SITE_NAME,
    text
  });
}

function paymentReceipt(payment, studentName) {
  const ghc = (payment.amount / 100).toFixed(2);
  const text =
    'Payment Confirmation\n\n' +
    'Reference: ' + payment.reference + '\n' +
    'Student: ' + (studentName || 'N/A') + '\n' +
    'Amount: GHS ' + ghc + '\n' +
    'Status: Successful\n\n' +
    'Thank you. This is a system generated receipt.';
  return sendMail({
    to: payment.email,
    subject: 'Payment Receipt GHS ' + ghc + ' - ' + SITE_NAME,
    text
  });
}

module.exports = { sendMail, applicationReceived, applicationDecided, paymentReceipt };