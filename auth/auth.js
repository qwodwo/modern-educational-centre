// Phase 4: real authentication for the portal (uses the /api backend)
(function() {
  var selectedRole = 'student';
  var msg = null;

  function showError(text) {
    var box = document.querySelector('.auth-alert');
    if (!box) {
      box = document.createElement('div');
      box.className = 'auth-alert';
      var form = document.getElementById('loginForm');
      if (form && form.parentNode) form.parentNode.insertBefore(box, form);
    }
    box.style.display = text ? 'block' : 'none';
    box.textContent = text || '';
  }

  document.addEventListener('DOMContentLoaded', function() {
    // already logged in? skip to dashboard
    if (MEC.token()) {
      MEC.me().then(function(u) {
        if (u) window.location.replace(MEC.redirectPath(u.role));
      });
    }

    // role picker
    var roleParam = new URLSearchParams(window.location.search).get('role');
    if (roleParam) selectedRole = roleParam;

    function setRole(role, fromClick) {
      selectedRole = role;
      document.querySelectorAll('#roleSelection .btn-primary').forEach(function(b) {
        var active = b.getAttribute('onclick') && b.getAttribute('onclick').indexOf("'" + role + "'") >= 0;
        b.classList.toggle('btn-primary-active', active);
        b.style.opacity = active ? '1' : '0.7';
      });
      if (fromClick && history.replaceState) history.replaceState(null, '', 'login.html?role=' + role);
    }
    window.setRole = function(role) { setRole(role, true); };
    setRole(selectedRole);

    // login
    var loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        showError('');
        var email = document.getElementById('username').value.trim();
        var password = document.getElementById('password').value;
        if (!email || !password) return showError('Please enter your email and password.');
        var btn = loginForm.querySelector('button[type="submit"]');
        var original = btn && btn.textContent;
        if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }
        MEC.login(email, password, selectedRole).then(function(res) {
          if (btn) { btn.disabled = false; btn.textContent = original; }
          if (res && res.ok) {
            window.location.href = MEC.redirectPath(res.user.role);
          } else {
            showError((res && res.error) || 'Unable to sign in. Please try again.');
          }
        });
      });
    }

    // role reminder label
    var remind = document.createElement('p');
    remind.className = 'auth-role-hint';
    remind.style.cssText = 'text-align:center;font-size:.85rem;opacity:.75;margin-bottom:1rem;';
    remind.innerHTML = 'Signing in as: <strong id="roleHint">' + selectedRole + '</strong>';
    var roleWrap = document.getElementById('roleSelection');
    if (roleWrap) roleWrap.appendChild(remind);

    // toggle login / register panels
    var loginPanel = document.getElementById('loginForm');
    var registerPanel = document.getElementById('registerForm');
    function togglePanels(showRegister) {
      if (loginPanel) loginPanel.style.display = showRegister ? 'none' : 'block';
      if (registerPanel) registerPanel.style.display = showRegister ? 'block' : 'none';
    }
    var registerLink = document.querySelector('.register-link');
    if (registerLink) registerLink.addEventListener('click', function(e) { e.preventDefault(); togglePanels(true); });
    var backToLogin = document.querySelector('.back-to-login');
    if (backToLogin) backToLogin.addEventListener('click', function(e) { e.preventDefault(); togglePanels(false); });

    // accounts are provisioned by the school's administration
    var regForm = document.querySelector('#registerForm form');
    if (regForm) {
      regForm.addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Portal accounts are created by the school administration. Please contact the school office (moderneducentre@gmail.com) or sign in with your provisioned account.');
      });
    }
  });
})();