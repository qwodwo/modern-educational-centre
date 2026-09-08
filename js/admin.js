// Phase 4: Administration dashboard client
(function() {
  var main = null;
  var toastEl = null;
  var state = { applications: [], students: [], fees: [], payments: [], news: [], events: [] };
  var currentView = 'overview';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function ghc(n) { return 'GHS ' + Number(n || 0).toFixed(2); }
  function date(s) { return String(s || '').slice(0, 10); }

  function toast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('show');
    setTimeout(function() { toastEl.classList.remove('show'); }, 3200);
  }

  function fetchOk(path) {
    return MEC.api(path).then(function(r) {
      if (r.status !== 200) throw new Error((r.data && r.data.error) || 'Request failed');
      return r.data;
    });
  }

  function postOk(path, body, method) {
    return MEC.api(path, { method: method || 'POST', body: body }).then(function(r) {
      if (r.status >= 400) throw new Error((r.data && r.data.error) || 'Request failed');
      return r.data;
    });
  }

  // ---------- rendering ----------

  function render(css) {
    var html = css || '';
    main.innerHTML = html;
  }

  function stat(num, lbl) { return '<div class="stat"><div class="num">' + num + '</div><div class="lbl">' + lbl + '</div></div>'; }

  function overview() {
    fetchOk('/api/reports/overview').then(function(d) {
      var o = d.overview;
      var rows =
        stat(o.students, 'Total Students') +
        stat(o.day, 'Day Programme') +
        stat(o.boarding, 'Boarding Programme') +
        stat(o.applications, 'Applications Received') +
        stat(o.applicationsByStatus.approved, 'Applications Approved') +
        stat(o.successfulPayments, 'Successful Payments') +
        stat(ghc(o.collections), 'Collected (GHS)') +
        stat(ghc(o.pendingBalance), 'Outstanding Balance') +
        stat(o.publishedNews, 'Published News') +
        stat(o.upcomingEvents, 'Upcoming Events');
      render('<h2>Overview</h2><div class="cards">' + rows + '</div>' +
        '<div class="panel"><h3>Application Pipeline</h3><p class="muted">Received: <b>' + o.applicationsByStatus.received + '</b> &middot; Reviewed: <b>' + o.applicationsByStatus.reviewed + '</b> &middot; Approved: <b>' + o.applicationsByStatus.approved + '</b> &middot; Rejected: <b>' + o.applicationsByStatus.rejected + '</b></p></div>');
    }).catch(function(e) { render('<p class="empty">' + esc(e.message) + '</p>'); });
  }

  function applications() {
    fetchOk('/api/applications').then(function(d) {
      state.applications = d.applications || [];
      var rows = state.applications.map(function(a) {
        var dl = a.documents > 0 && MEC.token()
          ? '<a class="dl" href="/api/applications/' + esc(a.id) + '/document/0?token=' + encodeURIComponent(MEC.token()) + '" title="Download first uploaded document">Download</a>'
          : '<span class="muted">—</span>';
        var actions = '<button class="a-btn success sm" data-act="approve" data-id="' + esc(a.id) + '">Approve</button> ' +
          '<button class="a-btn danger sm" data-act="reject" data-id="' + esc(a.id) + '">Reject</button>';
        if (a.status === 'received') {
          actions = '<button class="a-btn warn sm" data-act="review" data-id="' + esc(a.id) + '">Mark Reviewed</button> ' + actions;
        }
        return '<tr><td><b>' + esc(a.studentName) + '</b><div class="muted">' + esc(a.ref) + '</div></td>' +
          '<td>' + esc(a.gradeLevel) + '</td>' +
          '<td>' + (a.stream === 'boarding' ? 'Boarding' : 'Day') + '</td>' +
          '<td>' + esc(a.guardianName) + '</td>' +
          '<td>' + esc(a.guardianEmail) + '</td>' +
          '<td><span class="badge ' + esc(a.status) + '">' + esc(a.status).toUpperCase() + '</span></td>' +
          '<td>' + date(a.createdAt) + '</td>' +
          '<td>' + dl + '</td>' +
          '<td>' + actions + '</td></tr>';
      }).join('');
      render('<h2>Applications</h2><div class="panel"><table><thead><tr>' +
        '<th>Student</th><th>Level</th><th>Stream</th><th>Guardian</th><th>Guardian Email</th><th>Status</th><th>Received</th><th>Docs</th><th>Actions</th>' +
        '</tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="empty">No applications yet.</td></tr>') + '</tbody></table></div>');
    }).catch(function(e) { render('<p class="empty">' + esc(e.message) + '</p>'); });
  }

  function fees() {
    fetchOk('/api/fees').then(function(d) {
      state.fees = d.fees || [];
      var rows = state.fees.map(function(f) {
        return '<tr><td>' + esc(f.level) + '</td><td>' + esc(f.programme) + '</td><td>' + esc(f.term) + '</td><td>' + ghc(f.amount) + '</td><td>' + esc(f.description) + '</td><td><button class="a-btn danger sm" data-act="del-fee" data-id="' + esc(f.id) + '">Delete</button></td></tr>';
      }).join('');
      render('<h2>Fees</h2>' +
        '<div class="grid2">' +
        '<div class="panel forms"><h3>Add Fee Structure</h3>' +
        '<label>Level</label><select id="fee-level"><option>Preschool</option><option>Kindergarten</option><option>Primary</option><option>JHS</option></select>' +
        '<label>Programme</label><select id="fee-prog"><option>Day</option><option>Boarding</option></select>' +
        '<label>Term</label><input id="fee-term" placeholder="e.g. Term 2 2026">' +
        '<label>Amount (GHS)</label><input id="fee-amount" type="number" min="0" step="0.01" placeholder="e.g. 2500">' +
        '<label>Description</label><input id="fee-desc" placeholder="e.g. JHS 1-3 (Boarding) - Term 2">' +
        '<button class="a-btn primary" data-act="add-fee">Add Fee</button></div>' +
        '<div class="panel"><table><thead><tr><th>Level</th><th>Programme</th><th>Term</th><th>Amount</th><th>Description</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="6" class="empty">No fee structures.</td></tr>') + '</tbody></table></div></div>');
    }).catch(function(e) { render('<p class="empty">' + esc(e.message) + '</p>'); });
  }

  function payments() {
    Promise.all([fetchOk('/api/payments'), fetchOk('/api/students')]).then(function(results) {
      state.payments = results[0].payments || [];
      state.students = results[1].students || [];
      var rows = state.payments.map(function(p) {
        return '<tr><td>' + esc(p.reference) + '</td><td>' + esc(p.studentName) + '</td><td>' + esc(p.email) + '</td><td>' + esc(p.term) + '</td><td>' + ghc(p.amount) + '</td><td>' + esc(p.channel) + '</td><td><span class="badge ' + esc(p.status) + '">' + esc(p.status).toUpperCase() + '</span></td><td>' + date(p.verifiedAt || p.createdAt) + '</td></tr>';
      }).join('');
      var opts = state.students.map(function(s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + ' (' + esc(s.level) + ' - ' + esc(s.programme) + ')</option>'; }).join('');
      render('<h2>Payments</h2>' +
        '<div class="grid2">' +
        '<div class="panel forms"><h3>Record Manual Payment</h3>' +
        '<label>Student</label><select id="pm-student">' + opts + '</select>' +
        '<label>Amount (GHS)</label><input id="pm-amount" type="number" min="0" step="0.01">' +
        '<label>Channel</label><select id="pm-channel"><option value="manual">Cash / Bank</option><option value="mobile-money">Mobile Money</option></select>' +
        '<label>Note</label><input id="pm-note" placeholder="Optional note">' +
        '<button class="a-btn primary" data-act="add-manual">Record Payment</button></div>' +
        '<div class="panel"><table><thead><tr><th>Reference</th><th>Student</th><th>Email</th><th>Fee Term</th><th>Amount</th><th>Channel</th><th>Status</th><th>Date</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="8" class="empty">No payments recorded.</td></tr>') + '</tbody></table></div></div>');
    }).catch(function(e) { render('<p class="empty">' + esc(e.message) + '</p>'); });
  }

  function news() {
    fetchOk('/api/news?all=1').then(function(d) {
      state.news = d.news || [];
      var rows = state.news.map(function(n) {
        return '<tr><td>' + date(n.date) + '</td><td>' + esc(n.category) + '</td><td><b>' + esc(n.title) + '</b><div class="muted">' + esc((n.excerpt || '').slice(0, 80)) + '</div></td>' +
          '<td><span class="badge ' + (n.status === 'published' ? 'approved' : 'pending') + '">' + esc(n.status).toUpperCase() + '</span></td>' +
          '<td><button class="a-btn sm ' + (n.status === 'published' ? 'warn' : 'success') + '" data-act="toggle-news" data-id="' + esc(n.id) + '">' + (n.status === 'published' ? 'Unpublish' : 'Publish') + '</button> ' +
          '<button class="a-btn sm primary" data-act="edit-news" data-id="' + esc(n.id) + '">Edit</button> ' +
          '<button class="a-btn sm danger" data-act="del-news" data-id="' + esc(n.id) + '">Delete</button></td></tr>';
      }).join('');
      render('<h2>News</h2>' +
        '<div class="grid2"><div class="panel forms"><h3>Write News</h3>' +
        '<label>Title</label><input id="nw-title">' +
        '<label>Date</label><input id="nw-date" type="date">' +
        '<label>Category</label><select id="nw-cat"><option>Announcement</option><option>Academic</option><option>Achievement</option><option>Events</option><option>General</option></select>' +
        '<label>Excerpt</label><textarea id="nw-excerpt" rows="2"></textarea>' +
        '<label>Body</label><textarea id="nw-body" rows="4"></textarea>' +
        '<button class="a-btn primary" data-act="add-news">Publish News</button></div>' +
        '<div class="panel"><table><thead><tr><th>Date</th><th>Category</th><th>Title</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="5" class="empty">No news items.</td></tr>') + '</tbody></table></div></div>');
    }).catch(function(e) { render('<p class="empty">' + esc(e.message) + '</p>'); });
  }

  function events() {
    fetchOk('/api/events?all=1').then(function(d) {
      state.events = d.events || [];
      var rows = state.events.map(function(e) {
        return '<tr><td>' + date(e.date) + '</td><td>' + (e.time || '—') + '</td><td><b>' + esc(e.title) + '</b><div class="muted">' + esc(e.location || '') + '</div></td><td>' + esc((e.description || '').slice(0, 70)) + '</td>' +
          '<td><span class="badge ' + (e.status === 'published' ? 'approved' : 'pending') + '">' + esc(e.status).toUpperCase() + '</span></td>' +
          '<td><button class="a-btn sm ' + (e.status === 'published' ? 'warn' : 'success') + '" data-act="toggle-event" data-id="' + esc(e.id) + '">' + (e.status === 'published' ? 'Unpublish' : 'Publish') + '</button> ' +
          '<button class="a-btn sm primary" data-act="edit-event" data-id="' + esc(e.id) + '">Edit</button> ' +
          '<button class="a-btn sm danger" data-act="del-event" data-id="' + esc(e.id) + '">Delete</button></td></tr>';
      }).join('');
      render('<h2>Events</h2>' +
        '<div class="grid2"><div class="panel forms"><h3>Create Event</h3>' +
        '<label>Title</label><input id="ev-title">' +
        '<label>Date</label><input id="ev-date" type="date">' +
        '<label>Time</label><input id="ev-time" placeholder="e.g. 9:00am">' +
        '<label>Location</label><input id="ev-loc" placeholder="e.g. Assembly Hall">' +
        '<label>Description</label><textarea id="ev-desc" rows="3"></textarea>' +
        '<button class="a-btn primary" data-act="add-event">Publish Event</button></div>' +
        '<div class="panel"><table><thead><tr><th>Date</th><th>Time</th><th>Title</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="6" class="empty">No events.</td></tr>') + '</tbody></table></div></div>');
    }).catch(function(e) { render('<p class="empty">' + esc(e.message) + '</p>'); });
  }

  function reports() {
    Promise.all([fetchOk('/api/reports/collections'), fetchOk('/api/reports/overview')]).then(function(results) {
      var cols = results[0];
      var o = results[1].overview;
      var rows = cols.payments.map(function(p) {
        return '<tr><td>' + esc(p.reference) + '</td><td>' + date(p.createdAt) + '</td><td>' + esc(p.studentName) + '</td><td>' + esc(p.email) + '</td><td>' + esc(p.term) + '</td><td>' + ghc(p.amount) + '</td><td>' + esc(p.channel) + '</td></tr>';
      }).join('');
      render('<h2>Reports</h2>' +
        '<div class="cards">' +
        stat(o.students, 'Total Students') +
        stat(o.day + ' / ' + o.boarding, 'Day / Boarding') +
        stat(o.applications, 'Total Applications') +
        stat(ghc(cols.total), 'Collected to Date') +
        '</div>' +
        '<div class="panel"><h3>Collection Summary</h3><p>Total collected: <b>' + ghc(cols.total) + '</b> across <b>' + cols.count + '</b> successful payments.</p>' +
        '<p style="margin-top:.6rem"><a class="a-btn primary" href="/api/reports/collections.csv?token=' + encodeURIComponent(MEC.token()) + '" style="text-decoration:none">Download Collections CSV</a> ' +
        '<a class="a-btn warn" href="/api/reports/applications.csv?token=' + encodeURIComponent(MEC.token()) + '" style="text-decoration:none">Download Applications CSV</a></p></div>' +
        '<div class="panel"><h3>Payment Records</h3><table><thead><tr><th>Reference</th><th>Date</th><th>Student</th><th>Email</th><th>Fee Term</th><th>Amount</th><th>Channel</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="7" class="empty">No successful payments yet.</td></tr>') + '</tbody></table></div>');
    }).catch(function(e) { render('<p class="empty">' + esc(e.message) + '</p>'); });
  }

  function help() {
    render('<h2>Login Help</h2><div class="panel"><h3>Default Phase 4 accounts</h3><table><thead><tr><th>Role</th><th>Email</th><th>Password</th><th>Portal</th></tr></thead><tbody>' +
      '<tr><td>Administrator</td><td>admin@mec.edu.gh</td><td>Admin@123</td><td><a href="/admin/">/admin</a></td></tr>' +
      '<tr><td>Student</td><td>student@mec.edu.gh</td><td>Student@123</td><td>Student Portal</td></tr>' +
      '<tr><td>Parent</td><td>parent@mec.edu.gh</td><td>Parent@123</td><td>Parent Portal</td></tr>' +
      '<tr><td>Staff</td><td>staff@mec.edu.gh</td><td>Staff@123</td><td>Staff Portal</td></tr>' +
      '</tbody></table>' +
      '<p class="muted" style="margin-top:.8rem">New pupils are created automatically with a Student account when an application is approved (login = guardian email, password <b>Student@123</b>). Change these for production use.</p></div>');
  }

  // ---------- actions ----------

  var ACTIONS = {
    review: function(id) { appStatus(id, 'reviewed'); },
    approve: function(id) { appStatus(id, 'approved'); },
    reject: function(id) { appStatus(id, 'rejected'); },

    'add-fee': function() {
      var amount = Number(document.getElementById('fee-amount').value);
      if (isNaN(amount) || amount <= 0) return toast('Enter a valid amount');
      postOk('/api/fees', {
        level: document.getElementById('fee-level').value,
        programme: document.getElementById('fee-prog').value,
        term: document.getElementById('fee-term').value,
        amount: amount,
        description: document.getElementById('fee-desc').value
      }).then(function() { toast('Fee added'); fees(); }).catch(function(e) { toast(e.message); });
    },
    'del-fee': function(id) {
      postOk('/api/fees/' + id, {}, 'DELETE').then(function() { toast('Fee deleted'); fees(); }).catch(function(e) { toast(e.message); });
    },

    'add-manual': function() {
      var amount = Number(document.getElementById('pm-amount').value);
      if (isNaN(amount) || amount <= 0) return toast('Enter a valid amount');
      postOk('/api/payments/manual', {
        studentId: document.getElementById('pm-student').value,
        amount: amount,
        channel: document.getElementById('pm-channel').value,
        note: document.getElementById('pm-note').value
      }).then(function() { toast('Payment recorded'); payments(); }).catch(function(e) { toast(e.message); });
    },

    'add-news': function() {
      postOk('/api/news', {
        title: document.getElementById('nw-title').value,
        date: document.getElementById('nw-date').value || new Date().toISOString().slice(0, 10),
        category: document.getElementById('nw-cat').value,
        excerpt: document.getElementById('nw-excerpt').value,
        body: document.getElementById('nw-body').value,
        status: 'published'
      }).then(function() { toast('News published'); news(); }).catch(function(e) { toast(e.message); });
    },
    'toggle-news': function(id) {
      var n = state.news.find(function(x) { return x.id === id; });
      if (!n) return;
      postOk('/api/news/' + id, { status: n.status === 'published' ? 'draft' : 'published' }, 'PATCH')
        .then(function() { toast('Updated'); news(); }).catch(function(e) { toast(e.message); });
    },
    'edit-news': function(id) {
      var n = state.news.find(function(x) { return x.id === id; });
      if (!n) return;
      var title = prompt('Title', n.title);
      if (title === null) return;
      var excerpt = prompt('Excerpt', n.excerpt);
      var body = prompt('Body', n.body);
      postOk('/api/news/' + id, { title: title, excerpt: excerpt, body: body }, 'PATCH')
        .then(function() { toast('Saved'); news(); }).catch(function(e) { toast(e.message); });
    },
    'del-news': function(id) {
      if (!confirm('Delete this news item?')) return;
      postOk('/api/news/' + id, {}, 'DELETE').then(function() { toast('Deleted'); news(); }).catch(function(e) { toast(e.message); });
    },

    'add-event': function() {
      postOk('/api/events', {
        title: document.getElementById('ev-title').value,
        date: document.getElementById('ev-date').value,
        time: document.getElementById('ev-time').value,
        location: document.getElementById('ev-loc').value,
        description: document.getElementById('ev-desc').value,
        status: 'published'
      }).then(function() { toast('Event published'); events(); }).catch(function(e) { toast(e.message); });
    },
    'toggle-event': function(id) {
      var e = state.events.find(function(x) { return x.id === id; });
      if (!e) return;
      postOk('/api/events/' + id, { status: e.status === 'published' ? 'draft' : 'published' }, 'PATCH')
        .then(function() { toast('Updated'); events(); }).catch(function(m) { toast(m.message); });
    },
    'edit-event': function(id) {
      var e = state.events.find(function(x) { return x.id === id; });
      if (!e) return;
      var title = prompt('Title', e.title);
      if (title === null) return;
      var time = prompt('Time', e.time);
      var loc = prompt('Location', e.location);
      postOk('/api/events/' + id, { title: title, time: time, location: loc }, 'PATCH')
        .then(function() { toast('Saved'); events(); }).catch(function(m) { toast(m.message); });
    },
    'del-event': function(id) {
      if (!confirm('Delete this event?')) return;
      postOk('/api/events/' + id, {}, 'DELETE').then(function() { toast('Deleted'); events(); }).catch(function(e) { toast(e.message); });
    }
  };

  function appStatus(id, status) {
    postOk('/api/applications/' + id + '/status', { status: status }, 'PATCH')
      .then(function() { toast('Application ' + status); applications(); })
      .catch(function(e) { toast(e.message); });
  }

  // ---------- boot ----------

  function show(view) {
    currentView = view;
    document.querySelectorAll('.admin-nav button').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-view') === view);
    });
    var fn = { overview: overview, applications: applications, fees: fees, payments: payments, news: news, events: events, reports: reports, help: help }[view];
    if (fn) fn();
  }

  document.addEventListener('DOMContentLoaded', function() {
    main = document.getElementById('admin-main');
    toastEl = document.getElementById('toast');

    if (!window.MEC) return;
    MEC.me().then(function(user) {
      if (!user) {
        window.location.replace('../auth/login.html?role=admin');
        return;
      }
      if (user.role !== 'admin') {
        alert('This area requires an administrator account.');
        window.location.href = '../index.html';
        return;
      }
      var who = document.getElementById('admin-user-name');
      if (who) who.textContent = user.name;
    }).then(function() { show('overview'); }).catch(function() {
      window.location.replace('../auth/login.html?role=admin');
    });

    document.getElementById('admin-logout').addEventListener('click', function() {
      MEC.logout().then(function() { window.location.href = '../auth/login.html?role=admin'; });
    });

    document.querySelector('.admin-nav').addEventListener('click', function(e) {
      var b = e.target.closest('button[data-view]');
      if (b) show(b.getAttribute('data-view'));
    });

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      var id = btn.getAttribute('data-id');
      if (ACTIONS[act]) ACTIONS[act](id);
    });
  });
})();