'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = null;

function uid(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
}

function defaultDb() {
  const mkUser = (name, email, password, role, studentIds) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 32).toString('hex');
    return { id: uid('usr'), role, name, email, salt, hash, studentIds: studentIds || [], createdAt: new Date().toISOString() };
  };

  return {
    users: [
      mkUser('Head Administrator', 'admin@mec.edu.gh', 'Admin@123', 'admin'),
      mkUser('Ama Mensah', 'student@mec.edu.gh', 'Student@123', 'student', ['stu-1']),
      mkUser('Kwame Mensah', 'parent@mec.edu.gh', 'Parent@123', 'parent', ['stu-1']),
      mkUser('Mr. K. Anderson', 'staff@mec.edu.gh', 'Staff@123', 'staff')
    ],
    students: [
      {
        id: 'stu-1',
        name: 'Ama Mensah',
        level: 'JHS1',
        programme: 'Boarding',
        guardianEmail: 'parent@mec.edu.gh',
        guardianName: 'Kwame Mensah',
        guardianPhone: '+233240000000',
        applicationRef: null,
        createdAt: new Date().toISOString()
      }
    ],
    applications: [],
    fees: [
      { id: uid('fee'), level: 'Preschool', programme: 'Day', term: 'Term 1 2026', amount: 1500, description: 'Preschool (Day) - Term 1' },
      { id: uid('fee'), level: 'Preschool', programme: 'Boarding', term: 'Term 1 2026', amount: 3200, description: 'Preschool (Boarding) - Term 1' },
      { id: uid('fee'), level: 'Kindergarten', programme: 'Day', term: 'Term 1 2026', amount: 1700, description: 'Kindergarten (Day) - Term 1' },
      { id: uid('fee'), level: 'Primary', programme: 'Day', term: 'Term 1 2026', amount: 2100, description: 'Primary 1-5 (Day) - Term 1' },
      { id: uid('fee'), level: 'Primary', programme: 'Boarding', term: 'Term 1 2026', amount: 4100, description: 'Primary 1-5 (Boarding) - Term 1' },
      { id: uid('fee'), level: 'JHS', programme: 'Day', term: 'Term 1 2026', amount: 2600, description: 'JHS 1-3 (Day) - Term 1' },
      { id: uid('fee'), level: 'JHS', programme: 'Boarding', term: 'Term 1 2026', amount: 4800, description: 'JHS 1-3 (Boarding) - Term 1' }
    ],
    payments: [],
    news: [],
    events: [],
    sessions: []
  };
}

function load() {
  if (db) return db;
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    db = JSON.parse(raw);
    if (!db.users) throw new Error('missing users');
  } catch (err) {
    if (!db || !db.users) {
      db = defaultDb();
      save();
    }
  }
  return db;
}

let writeQueue = Promise.resolve();

function save() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  writeQueue = writeQueue.then(() => {
    return new Promise((resolve, reject) => {
      fs.writeFile(tmp, JSON.stringify(load(), null, 2), 'utf8', (err) => {
        if (err) return reject(err);
        fs.rename(tmp, DB_FILE, (e) => (e ? reject(e) : resolve()));
      });
    });
  });
  return writeQueue;
}

function reset() {
  db = defaultDb();
  return save();
}

module.exports = { load, save, reset, uid };