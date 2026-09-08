// Phase 4: shared client helper for the portal/API (auth, sessions, guards)
(function() {
  var TOKEN_KEY = 'mec_token';

  function token() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {} }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  function api(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers['Content-Type'] = 'application/json';
    var t = token();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    return fetch(path, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    }).then(function(r) {
      return r.json().catch(function() { return {}; }).then(function(data) {
        return { status: r.status, data: data };
      });
    }).catch(function(err) {
      return { status: 0, data: { ok: false, error: err.message || 'Network error' } };
    });
  }

  function login(email, password, role) {
    return api('/api/auth/login', { method: 'POST', body: { email: email, password: password, role: role } })
      .then(function(r) {
        if (r.status === 200 && r.data.ok) setToken(r.data.token);
        return r.data;
      });
  }

  function logout() {
    return api('/api/auth/logout', { method: 'POST' }).then(function() { clearToken(); });
  }

  function me() {
    return api('/api/me').then(function(r) { return r.status === 200 ? r.data.user : null; });
  }

  function redirectPath(role) {
    if (role === 'admin') return '/admin/';
    var map = { student: 'auth/student-dashboard.html', parent: 'auth/parent-dashboard.html', staff: 'auth/staff-dashboard.html' };
    return map[role] || 'index.html';
  }

  // Guard for /auth dashboard pages: bounce to login when session invalid, then boot page logic.
  function guard(role) {
    me().then(function(user) {
      if (!user || (role && user.role !== role)) {
        window.location.replace('login.html');
        return;
      }
      var nameEl = document.getElementById(user.role + '-name') || document.getElementById('user-name');
      if (nameEl) nameEl.textContent = user.name;
      document.dispatchEvent(new CustomEvent('mec:user', { detail: user }));
    });
  }

  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el !== document) {
      if (el.id === 'logout-btn') {
        e.preventDefault();
        logout().then(function() { window.location.href = 'login.html'; });
        return;
      }
      el = el.parentNode;
    }
  });

  window.MEC = {
    token: token,
    setToken: setToken,
    clearToken: clearToken,
    api: api,
    login: login,
    logout: logout,
    me: me,
    redirectPath: redirectPath,
    guard: guard
  };
})();