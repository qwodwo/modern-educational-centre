'use strict';

const crypto = require('crypto');
const db = require('./db');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.scryptSync(password, salt, 32);
  const expected = Buffer.from(expectedHash, 'hex');
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}

function tokenDigest(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function issueSession(userId) {
  const data = db.load();
  const token = crypto.randomBytes(32).toString('base64url');
  data.sessions.push({
    tokenHash: tokenDigest(token),
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
  });
  db.save();
  return token;
}

function revokeSession(token) {
  const data = db.load();
  data.sessions = data.sessions.filter((s) => s.tokenHash !== tokenDigest(token));
  db.save();
}

function userFromToken(token) {
  if (!token) return null;
  const data = db.load();
  const digest = tokenDigest(token);
  const session = data.sessions.find((s) => s.tokenHash === digest);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  return data.users.find((u) => u.id === session.userId) || null;
}

function requireToken(req) {
  const header = req.headers['authorization'] || '';
  if (header.indexOf('Bearer ') === 0) return header.slice(7);
  if (req.query instanceof URLSearchParams) return req.query.get('token');
  return req.query && req.query.token ? req.query.token : null;
}

function requireUser(req, role) {
  const token = requireToken(req);
  const user = userFromToken(token);
  if (!user) {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }
  if (role && user.role !== role) {
    const err = new Error('Forbidden: admin access required');
    err.status = 403;
    throw err;
  }
  return user;
}

module.exports = {
  hashPassword,
  verifyPassword,
  issueSession,
  revokeSession,
  userFromToken,
  requireToken,
  requireUser
};