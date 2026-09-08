'use strict';

const https = require('https');
const CONFIG = require('../config/config.json');

const BASE = 'https://api.paystack.co';
const isConfigured = () => !!(CONFIG.paystack && CONFIG.paystack.secretKey);

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      method,
      hostname: 'api.paystack.co',
      path,
      headers: {
        Authorization: 'Bearer ' + CONFIG.paystack.secretKey,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, json: { message: data } });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function initialize({ email, amountPesewas, reference, callback_url, metadata }) {
  if (!isConfigured()) {
    const err = new Error('Paystack not configured. Add publicKey/secretKey to config/config.json');
    err.code = 'PAYSTACK_UNCONFIGURED';
    throw err;
  }
  return request('POST', '/transaction/initialize', {
    email,
    amount: amountPesewas,
    reference,
    callback_url,
    metadata: metadata || {},
    currency: 'GHS'
  });
}

function verify(reference) {
  if (!isConfigured()) {
    const err = new Error('Paystack not configured.');
    err.code = 'PAYSTACK_UNCONFIGURED';
    throw err;
  }
  return request('GET', '/transaction/verify/' + encodeURIComponent(reference));
}

module.exports = { initialize, verify, isConfigured };