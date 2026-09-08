'use strict';

const db = require('./db');
const auth = require('./auth');
const email = require('./email');
const sms = require('./sms');
const paystack = require('./paystack');
const CONFIG = require('../config/config.json');

const BASE_URL = (CONFIG.site && CONFIG.site.baseUrl) || 'http://127.0.0.1:8000';

// ---------- helpers ----------

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(payload);
}

function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error('[api]', err.stack || err.message);
  sendJson(res, status, { ok: false, error: err.message || 'Internal error' });
}

function readBody(req, limit) {
  limit = limit || 8 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        const err = new Error('Request body too large (max ' + Math.round(limit / 1048576) + 'MB)');
        err.status = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (size === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        const err = new Error('Invalid JSON body');
        err.status = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function levelKey(level) {
  const l = (level || '').toLowerCase();
  if (l.indexOf('jhs') === 0 || l.indexOf(' junior') === 0) return 'JHS';
  if (l.indexOf('kin') === 0) return 'Kindergarten';
  if (l.indexOf('pre') === 0) return 'Preschool';
  // numeric grades 1-5 -> Primary; 6-9 -> JHS
  const m = /(\d)/.exec(l);
  if (m) {
    const n = parseInt(m[1], 10);
    return n <= 5 ? 'Primary' : 'JHS';
  }
  if (l.indexOf('primary') === 0 || l.indexOf('grade') === 0 || l.indexOf('class') === 0) return 'Primary';
  return 'Primary';
}

function applicableFees(student) {
  const data = db.load();
  const streamKey = levelKey(student ? student.level : '');
  const prog = student && student.programme === 'Boarding' ? 'Boarding' : 'Day';
  const direct = data.fees.filter((f) => f.programme === prog && f.level === streamKey);
  return direct.length ? direct : data.fees.filter((f) => f.programme === prog);
}

function paidTotal(data, studentId, fee) {
  return data.payments
    .filter((p) => p.status === 'success' && p.studentId === studentId && p.term === fee.term)
    .reduce((sum, p) => sum + p.amount, 0);
}

function feeSummary(student) {
  const data = db.load();
  return applicableFees(student).map((fee) => {
    const paid = paidTotal(data, student.id, fee);
    return {
      feeId: fee.id,
      level: fee.level,
      programme: fee.programme,
      term: fee.term,
      description: fee.description,
      amount: fee.amount,
      paid,
      outstanding: Math.max(fee.amount - paid, 0)
    };
  });
}

function guardianInfo(application) {
  return {
    studentName: application.studentName,
    ref: application.ref,
    stream: application.stream,
    gradeLevel: application.gradeLevel,
    guardianName: application.guardianName,
    guardianEmail: application.guardianEmail,
    guardianPhone: application.guardianPhone,
    status: application.status
  };
}

function publicNews(items) {
  return items.filter((n) => n.status === 'published').map((n) => ({
    id: n.id, title: n.title, date: n.date, category: n.category || 'General', excerpt: n.excerpt, body: n.body
  }));
}

// ---------- router ----------

const routes = [];

function route(method, pattern, handler) {
  routes.push({ method, pattern, handler });
}

function match(pattern, segments) {
  if (pattern.length !== segments.length) return null;
  const params = {};
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '*') {
      params['*'] = segments[i];
    } else if (pattern[i] !== segments[i]) {
      return null;
    }
  }
  return params;
}

// ----- auth -----

route('POST', ['auth', 'login'], async (req, res, segments, query, body) => {
  const emailAddr = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!emailAddr || !password) return sendJson(res, 400, { ok: false, error: 'Email and password are required.' });
  const data = db.load();
  const user = data.users.find((u) => u.email.toLowerCase() === emailAddr);
  if (!user || !auth.verifyPassword(password, user.salt, user.hash)) {
    return sendJson(res, 401, { ok: false, error: 'Invalid email or password.' });
  }
  if (body.role && user.role !== body.role) {
    return sendJson(res, 403, { ok: false, error: 'This account is not registered for the selected role.' });
  }
  const token = auth.issueSession(user.id);
  return sendJson(res, 200, {
    ok: true,
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

route('POST', ['auth', 'logout'], async (req, res) => {
  const token = auth.requireToken(req);
  if (token) auth.revokeSession(token);
  return sendJson(res, 200, { ok: true });
});

route('GET', ['me'], async (req, res) => {
  const user = auth.requireUser(req);
  const data = db.load();
  const out = { id: user.id, name: user.name, email: user.email, role: user.role };
  if (user.role === 'student') {
    const student = data.students.find((s) => s.id === (user.studentIds && user.studentIds[0]));
    out.student = student ? { id: student.id, name: student.name, level: student.level, programme: student.programme } : null;
    if (out.student) out.fees = feeSummary(student);
  } else if (user.role === 'parent') {
    const children = data.students.filter((s) => (user.studentIds || []).indexOf(s.id) >= 0);
    out.children = children.map((s) => ({ id: s.id, name: s.name, level: s.level, programme: s.programme, fees: feeSummary(s) }));
  }
  return sendJson(res, 200, { ok: true, user: out });
});

// ----- students -----

route('GET', ['students'], async (req, res) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  return sendJson(res, 200, {
    ok: true,
    students: data.students.map((s) => ({
      id: s.id, name: s.name, level: s.level, programme: s.programme,
      guardianName: s.guardianName, guardianEmail: s.guardianEmail, guardianPhone: s.guardianPhone
    })).sort((a, b) => (a.name < b.name ? -1 : 1))
  });
});

// ----- applications -----

route('POST', ['applications'], async (req, res, segments, query, body) => {
  const app = body || {};
  const required = ['stream', 'studentName', 'gradeLevel', 'guardianName', 'guardianEmail'];
  for (const key of required) {
    if (!app[key] || !String(app[key]).trim()) {
      return sendJson(res, 400, { ok: false, error: 'Missing required field: ' + key });
    }
  }
  const documents = Array.isArray(app.documents) ? app.documents : [];
  if (documents.length > 3) return sendJson(res, 400, { ok: false, error: 'A maximum of 3 documents may be uploaded.' });
  for (const d of documents) {
    if (d.data && d.data.length > 4 * 1024 * 1024) {
      return sendJson(res, 400, { ok: false, error: 'Document "' + (d.name || '') + '" is too large (max ~3MB).' });
    }
  }
  const data = db.load();
  const ref = 'APP-' + Date.now().toString(36).toUpperCase() + '-' + String(Math.floor(Math.random() * 900) + 100);
  const application = {
    id: 'app-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000),
    ref,
    stream: app.stream,
    studentName: app.studentName.trim(),
    dob: app.dob || '',
    gradeLevel: app.gradeLevel,
    house: app.house || '',
    programme: Array.isArray(app.programme) ? app.programme : [],
    orientation: app.orientation || '',
    transport: app.transport || '',
    boardingType: app.boardingType || '',
    medicalNotes: app.medicalNotes || '',
    guardianStatement: app.guardianStatement || '',
    guardianName: app.guardianName.trim(),
    guardianEmail: app.guardianEmail.trim(),
    guardianPhone: app.guardianPhone || '',
    documents: documents.map((d) => ({
      name: String(d.name || '').slice(0, 200),
      type: String(d.type || 'application/octet-stream').slice(0, 100),
      size: parseInt(d.size, 10) || 0,
      data: d.data || ''
    })),
    status: 'received',
    createdAt: new Date().toISOString(),
    decidedAt: null,
    decisionNote: '',
    studentId: null
  };
  data.applications.push(application);
  await db.save();

  const admin = data.users.find((u) => u.role === 'admin');
  const recipients = [application.guardianEmail];
  if (admin) recipients.push(admin.email);
  email.applicationReceived(guardianInfo(application), recipients);
  sms.send('[MEC] Application ' + application.ref + ' for ' + application.studentName + ' received.');

  return sendJson(res, 201, {
    ok: true,
    application: { id: application.id, ref: application.ref, status: application.status, studentName: application.studentName }
  });
});

route('GET', ['applications'], async (req, res) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  return sendJson(res, 200, {
    ok: true,
    applications: data.applications.map((a) => ({
      id: a.id, ref: a.ref, studentName: a.studentName, gradeLevel: a.gradeLevel, stream: a.stream,
      guardianName: a.guardianName, guardianEmail: a.guardianEmail, guardianPhone: a.guardianPhone,
      status: a.status, createdAt: a.createdAt, documents: a.documents.length, studentId: a.studentId
    })).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  });
});

route('GET', ['applications', '*', 'document', '*'], async (req, res, segments, query) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  const app = data.applications.find((a) => a.id === decodeURIComponent(segments[1]));
  const idx = parseInt(decodeURIComponent(segments[3]), 10);
  if (!app || !app.documents[idx]) return sendJson(res, 404, { ok: false, error: 'Document not found' });
  const doc = app.documents[idx];
  const buf = Buffer.from(doc.data || '', 'base64');
  const safeName = doc.name.replace(/[^a-zA-Z0-9._()-]/g, '_');
  res.writeHead(200, {
    'Content-Type': doc.type,
    'Content-Disposition': 'attachment; filename="' + safeName + '"',
    'Content-Length': buf.length
  });
  return res.end(buf);
});

route('PATCH', ['applications', '*', 'status'], async (req, res, segments, query, body) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  const app = data.applications.find((a) => a.id === decodeURIComponent(segments[1]));
  if (!app) return sendJson(res, 404, { ok: false, error: 'Application not found' });
  const status = body.status;
  if (!['received', 'reviewed', 'approved', 'rejected'].includes(status)) {
    return sendJson(res, 400, { ok: false, error: 'Invalid status' });
  }
  app.status = status;
  app.decisionNote = body.note || app.decisionNote;
  if (status === 'reviewed') app.reviewedAt = new Date().toISOString();
  if (status === 'approved' || status === 'rejected') app.decidedAt = new Date().toISOString();

  if (status === 'approved' && !app.studentId) {
    const student = {
      id: 'stu-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000),
      name: app.studentName,
      level: app.gradeLevel,
      programme: app.stream === 'boarding' ? 'Boarding' : 'Day',
      guardianEmail: app.guardianEmail,
      guardianName: app.guardianName,
      guardianPhone: app.guardianPhone,
      applicationRef: app.ref,
      createdAt: new Date().toISOString()
    };
    data.students.push(student);
    app.studentId = student.id;

    let existing = data.users.find((u) => u.email.toLowerCase() === app.guardianEmail.toLowerCase());
    if (!existing) {
      const creds = auth.hashPassword('Student@123');
      existing = {
        id: 'usr-' + Date.now().toString(36) + '-s',
        role: 'student',
        name: app.studentName,
        email: app.guardianEmail,
        salt: creds.salt,
        hash: creds.hash,
        studentIds: [student.id],
        createdAt: new Date().toISOString()
      };
      data.users.push(existing);
      sms.send('[MEC] Login created for ' + app.studentName + ' (student@ your guardian email / Student@123)');
    } else if ((existing.studentIds || []).indexOf(student.id) < 0) {
      existing.studentIds = existing.studentIds || [];
      existing.studentIds.push(student.id);
    }
  }

  await db.save();
  email.applicationDecided(guardianInfo(app));
  return sendJson(res, 200, { ok: true, application: { id: app.id, ref: app.ref, status: app.status, studentId: app.studentId } });
});

// ----- fees -----

route('GET', ['fees'], async (req, res) => {
  const user = auth.requireUser(req, 'admin');
  return sendJson(res, 200, { ok: true, fees: db.load().fees });
});

route('POST', ['fees'], async (req, res, segments, query, body) => {
  const user = auth.requireUser(req, 'admin');
  if (!body.level || !body.programme || !body.term || !(Number(body.amount) >= 0)) {
    return sendJson(res, 400, { ok: false, error: 'level, programme, term and amount are required.' });
  }
  const fee = {
    id: db.uid('fee'),
    level: body.level,
    programme: body.programme,
    term: body.term,
    amount: Math.round(Number(body.amount) * 100) / 100,
    description: body.description || ''
  };
  const data = db.load();
  data.fees.push(fee);
  await db.save();
  return sendJson(res, 201, { ok: true, fee });
});

route('DELETE', ['fees', '*'], async (req, res, segments) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  const id = decodeURIComponent(segments[1]);
  data.fees = data.fees.filter((f) => f.id !== id);
  await db.save();
  return sendJson(res, 200, { ok: true });
});

// ----- payments -----

route('POST', ['payments', 'init'], async (req, res, segments, query, body) => {
  const user = auth.requireUser(req);
  if (!['student', 'parent'].includes(user.role)) return sendJson(res, 403, { ok: false, error: 'Only students and parents can initiate payments.' });
  const data = db.load();
  const student = data.students.find((s) => s.id === body.studentId);
  if (!student) return sendJson(res, 404, { ok: false, error: 'Student not found' });
  if (user.role === 'student' && ((user.studentIds || [])[0] !== student.id)) {
    return sendJson(res, 403, { ok: false, error: 'You can only pay for your own fee account.' });
  }
  if (user.role === 'parent' && (user.studentIds || []).indexOf(student.id) < 0) {
    return sendJson(res, 403, { ok: false, error: 'Not your child.' });
  }
  const summary = feeSummary(student).find((f) => f.feeId === body.feeId) || feeSummary(student)[0];
  if (!summary || summary.outstanding <= 0) return sendJson(res, 400, { ok: false, error: 'No outstanding balance for the selected fee.' });

  const reference = 'MEC-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 90000 + 10000);
  const payment = {
    id: db.uid('pay'),
    reference,
    studentId: student.id,
    studentName: student.name,
    email: user.email,
    feeId: summary.feeId,
    term: summary.term,
    amount: summary.amount,
    channel: 'paystack',
    status: 'pending',
    createdAt: new Date().toISOString(),
    verifiedAt: null
  };
  data.payments.push(payment);
  await db.save();

  try {
    const result = await paystack.initialize({
      email: user.email,
      amountPesewas: Math.round(summary.amount * 100),
      reference,
      callback_url: BASE_URL + '/api/payments/verify?reference=' + reference,
      metadata: { studentId: student.id, studentName: student.name, feeId: summary.feeId, term: summary.term }
    });
    if (result.status >= 400) {
      return sendJson(res, 502, { ok: false, error: 'Paystack error: ' + ((result.json && result.json.message) || result.status) });
    }
    return sendJson(res, 200, {
      ok: true,
      authorization_url: result.json.data.authorization_url,
      reference,
      amount: summary.amount
    });
  } catch (err) {
    return sendJson(res, err.code === 'PAYSTACK_UNCONFIGURED' ? 503 : 500, {
      ok: false,
      error: err.code === 'PAYSTACK_UNCONFIGURED'
        ? 'Paystack is not configured yet. Add your Paystack keys to config/config.json.'
        : err.message
    });
  }
});

route('GET', ['payments', 'verify'], async (req, res, segments, query) => {
  const reference = query.get('reference') || '';
  const data = db.load();
  const payment = data.payments.find((p) => p.reference === reference);
  if (!payment) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    return res.end('<h2>Payment reference not found.</h2>');
  }
  let status = 'failed';
  if (payment.status !== 'success') {
    try {
      const result = await paystack.verify(reference);
      const verified = result.json && result.json.data && result.json.data.status === 'success';
      status = verified ? 'success' : (result.json && result.json.data && result.json.data.status) || 'failed';
    } catch (err) {
      status = 'failed';
    }
    payment.status = status;
    payment.verifiedAt = new Date().toISOString();
    await db.save();
    if (status === 'success') {
      email.paymentReceipt(payment, payment.studentName);
      sms.send('[MEC] Payment GHS ' + (payment.amount).toFixed(2) + ' confirmed for ' + payment.studentName + '.');
    }
  } else {
    status = 'success';
  }

  const html =
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Payment Status</title>' +
    '<style>body{font-family:system-ui;background:#1a2a4a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}' +
    '.box{background:#fff;color:#1a2a4a;padding:2rem;border-radius:10px;text-align:center;max-width:420px}' +
    'h2{margin-top:0}a{display:inline-block;margin-top:1rem;color:#1a2a4a}</style></head>' +
    '<body><div class="box"><h2 style="color:' + (status === 'success' ? '#15803d' : '#b91c1c') + '">Payment ' + status.toUpperCase() + '</h2>' +
    '<p>Reference: <strong>' + payment.reference + '</strong></p>' +
    '<p>Student: ' + payment.studentName + '</p>' +
    '<p>Amount: GHS <strong>' + payment.amount.toFixed(2) + '</strong></p>' +
    '<a href="' + BASE_URL + '/auth/login.html">Return to login</a></div></body></html>';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  return res.end(html);
});

route('GET', ['payments'], async (req, res) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  return sendJson(res, 200, { ok: true, payments: data.payments.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
});

route('POST', ['payments', 'manual'], async (req, res, segments, query, body) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  const student = data.students.find((s) => s.id === body.studentId);
  if (!student) return sendJson(res, 404, { ok: false, error: 'Student not found' });
  const fee = applicableFees(student)[0];
  const payment = {
    id: db.uid('pay'),
    reference: 'MAN-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 90000 + 10000),
    studentId: student.id,
    studentName: student.name,
    email: student.guardianEmail || user.email,
    feeId: fee ? fee.id : null,
    term: fee ? fee.term : 'Manual',
    amount: Math.round(Number(body.amount) * 100) / 100,
    channel: body.channel || 'manual',
    status: 'success',
    note: body.note || '',
    createdAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString()
  };
  data.payments.push(payment);
  await db.save();
  email.paymentReceipt(payment, student.name);
  return sendJson(res, 201, { ok: true, payment });
});

// ----- news -----

route('GET', ['news'], async (req, res, segments, query) => {
  const all = query.get('all') === '1';
  let user = null;
  if (all) user = auth.requireUser(req, 'admin');
  const items = db.load().news;
  return sendJson(res, 200, { ok: true, news: all ? items : publicNews(items) });
});

route('POST', ['news'], async (req, res, segments, query, body) => {
  const user = auth.requireUser(req, 'admin');
  if (!body.title || !body.excerpt) return sendJson(res, 400, { ok: false, error: 'title and excerpt are required.' });
  const item = {
    id: db.uid('new'),
    title: body.title,
    date: body.date || new Date().toISOString().slice(0, 10),
    category: body.category || 'General',
    excerpt: body.excerpt,
    body: body.body || '',
    image: body.image || '',
    status: body.status === 'published' ? 'published' : 'draft',
    createdAt: new Date().toISOString()
  };
  const data = db.load();
  data.news.push(item);
  await db.save();
  return sendJson(res, 201, { ok: true, item });
});

route('PATCH', ['news', '*'], async (req, res, segments, query, body) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  const item = data.news.find((n) => n.id === decodeURIComponent(segments[1]));
  if (!item) return sendJson(res, 404, { ok: false, error: 'News item not found' });
  ['title', 'date', 'category', 'excerpt', 'body', 'image'].forEach((k) => {
    if (body[k] !== undefined) item[k] = body[k];
  });
  if (body.status === 'published' || body.status === 'draft') item.status = body.status;
  await db.save();
  return sendJson(res, 200, { ok: true, item });
});

route('DELETE', ['news', '*'], async (req, res, segments) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  data.news = data.news.filter((n) => n.id !== decodeURIComponent(segments[1]));
  await db.save();
  return sendJson(res, 200, { ok: true });
});

// ----- events -----

route('GET', ['events'], async (req, res, segments, query) => {
  const all = query.get('all') === '1';
  let user = null;
  if (all) user = auth.requireUser(req, 'admin');
  const items = db.load().events;
  let out = items;
  if (!all) {
    const today = new Date().toISOString().slice(0, 10);
    out = items.filter((e) => e.status === 'published' && e.date >= today).sort((a, b) => (a.date > b.date ? 1 : -1));
  }
  return sendJson(res, 200, { ok: true, events: out });
});

route('POST', ['events'], async (req, res, segments, query, body) => {
  const user = auth.requireUser(req, 'admin');
  if (!body.title || !body.date) return sendJson(res, 400, { ok: false, error: 'title and date are required.' });
  const item = {
    id: db.uid('evt'),
    title: body.title,
    date: body.date,
    time: body.time || '',
    location: body.location || '',
    description: body.description || '',
    status: body.status === 'published' ? 'published' : 'draft',
    createdAt: new Date().toISOString()
  };
  const data = db.load();
  data.events.push(item);
  await db.save();
  return sendJson(res, 201, { ok: true, item });
});

route('PATCH', ['events', '*'], async (req, res, segments, query, body) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  const item = data.events.find((e) => e.id === decodeURIComponent(segments[1]));
  if (!item) return sendJson(res, 404, { ok: false, error: 'Event not found' });
  ['title', 'date', 'time', 'location', 'description'].forEach((k) => {
    if (body[k] !== undefined) item[k] = body[k];
  });
  if (body.status === 'published' || body.status === 'draft') item.status = body.status;
  await db.save();
  return sendJson(res, 200, { ok: true, item });
});

route('DELETE', ['events', '*'], async (req, res, segments) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  data.events = data.events.filter((e) => e.id !== decodeURIComponent(segments[1]));
  await db.save();
  return sendJson(res, 200, { ok: true });
});

// ----- reports -----

route('GET', ['reports', 'overview'], async (req, res) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  const success = data.payments.filter((p) => p.status === 'success');
  const collections = success.reduce((sum, p) => sum + p.amount, 0);
  const overview = {
    students: data.students.length,
    day: data.students.filter((s) => s.programme === 'Day').length,
    boarding: data.students.filter((s) => s.programme === 'Boarding').length,
    applications: data.applications.length,
    applicationsByStatus: {
      received: data.applications.filter((a) => a.status === 'received').length,
      reviewed: data.applications.filter((a) => a.status === 'reviewed').length,
      approved: data.applications.filter((a) => a.status === 'approved').length,
      rejected: data.applications.filter((a) => a.status === 'rejected').length
    },
    payments: data.payments.length,
    successfulPayments: success.length,
    collections,
    pendingBalance: data.students.reduce((sum, s) => sum + feeSummary(s).reduce((a, f) => a + f.outstanding, 0), 0),
    publishedNews: data.news.filter((n) => n.status === 'published').length,
    upcomingEvents: data.events.filter((e) => e.status === 'published').length
  };
  return sendJson(res, 200, { ok: true, overview });
});

route('GET', ['reports', 'collections'], async (req, res, segments, query) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  const from = query.get('from') || null;
  const to = query.get('to') || null;
  let list = data.payments.filter((p) => p.status === 'success');
  if (from) list = list.filter((p) => p.createdAt.slice(0, 10) >= from);
  if (to) list = list.filter((p) => p.createdAt.slice(0, 10) <= to);
  list = list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const total = list.reduce((sum, p) => sum + p.amount, 0);
  return sendJson(res, 200, { ok: true, total: Math.round(total * 100) / 100, count: list.length, payments: list });
});

function csv(rows) {
  return rows.map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
}

route('GET', ['reports', 'collections.csv'], async (req, res) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  const rows = [
    ['Reference', 'Date', 'Student', 'Email', 'Fee Term', 'Channel', 'Amount (GHS)', 'Status'],
    ...data.payments
      .filter((p) => p.status === 'success')
      .map((p) => [p.reference, p.createdAt.slice(0, 10), p.studentName, p.email, p.term, p.channel, p.amount.toFixed(2), p.status])
  ];
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="collections-report.csv"'
  });
  return res.end(csv(rows));
});

route('GET', ['reports', 'applications.csv'], async (req, res) => {
  const user = auth.requireUser(req, 'admin');
  const data = db.load();
  const rows = [
    ['Ref', 'Date', 'Student', 'Level', 'Stream', 'Guardian', 'Guardian Email', 'Phone', 'Status'],
    ...data.applications.map((a) => [
      a.ref, a.createdAt.slice(0, 10), a.studentName, a.gradeLevel, a.stream, a.guardianName, a.guardianEmail, a.guardianPhone, a.status
    ])
  ];
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="applications-report.csv"'
  });
  return res.end(csv(rows));
});

// ----- health -----

route('GET', ['health'], async (req, res) => {
  return sendJson(res, 200, { ok: true, name: 'MEC Website API', version: '4.0.0' });
});

// ---------- entry ----------

function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  if (!pathname.startsWith('/api')) return false;

  let segments = pathname.slice(4).split('/').filter(Boolean).map(decodeURIComponent);
  db.load(); // ensure seed
  req.query = url.searchParams;

  (async () => {
    let body;
    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
      body = await readBody(req);
    }
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const params = match(r.pattern, segments);
      if (!params) continue;
      try {
        await r.handler(req, res, segments, url.searchParams, body || {});
      } catch (err) {
        sendError(res, err);
      }
      return;
    }
    return sendJson(res, 404, { ok: false, error: 'API endpoint not found: ' + req.method + ' ' + pathname });
  })();

  return true;
}

module.exports = { handle };