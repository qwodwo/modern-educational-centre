// Phase 4: Pay Fees UI for Student & Parent dashboards (Paystack checkout)
(function() {
  var STYLE =
    '<style>' +
    '.fee-list{list-style:none;padding:0;margin:.6rem 0 0}' +
    '.fee-row{display:flex;justify-content:space-between;align-items:center;gap:.5rem;padding:.55rem 0;border-bottom:1px solid rgba(26,42,74,.1);font-size:.9rem}' +
    '.fee-row:last-child{border-bottom:none}' +
    '.fee-bal{font-weight:700;color:#b91c1c}' +
    '.fee-paid{color:#15803d;font-weight:700}' +
    '.pay-btn{border:none;background:#1a2a4a;color:#fff;padding:.4rem .8rem;border-radius:6px;cursor:pointer;font-size:.82rem}' +
    '.pay-btn[disabled]{opacity:.6;cursor:default}' +
    '</style>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function ghc(n) { return 'GHS ' + Number(n || 0).toFixed(2); }

  function pay(studentId, feeId, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Opening checkout...'; }
    MEC.api('/api/payments/init', { method: 'POST', body: { studentId: studentId, feeId: feeId } })
      .then(function(r) {
        var d = r.data || {};
        if (r.status === 200 && d.ok && d.authorization_url) {
          window.location.href = d.authorization_url;
          return;
        }
        if (btn) { btn.disabled = false; btn.textContent = 'Pay Now'; }
        alert((d && d.error) || 'Could not start payment. Please try again or contact the school office.');
      });
  }

  function feeRows(student, ownerRole) {
    var fees = student.fees || [];
    var outs = fees.filter(function(f) { return f.outstanding > 0; });
    var row = '<div class="fee-list">';
    if (!fees.length) {
      row += '<p style="font-size:.9rem;opacity:.8;margin:.4rem 0">No fee structures set for this student yet.</p></div>';
      return row;
    }
    outs.forEach(function(f) {
      row += '<div class="fee-row"><span>' + esc(f.term) + ' &middot; ' + esc(f.description || '') + '</span>' +
        '<span style="display:flex;align-items:center;gap:.6rem"><strong class="fee-bal">' + ghc(f.outstanding) + '</strong>' +
        '<button type="button" class="pay-btn" data-sid="' + esc(student.id) + '" data-fid="' + esc(f.feeId) + '">Pay Now</button></span></div>';
    });
    if (!outs.length) {
      row += '<p style="font-size:.9rem;color:#15803d;margin:.4rem 0">All fees settled - nothing outstanding. &#10003;</p>';
    }
    row += '</div>';
    return row;
  }

  function renderStudent(user) {
    var grid = document.querySelector('.dashboard-grid');
    if (!grid || !user.student) return;
    var title = user.student.name + ' &middot; ' + esc(user.student.level) + ' (' + esc(user.student.programme) + ')';
    var card = document.createElement('div');
    card.className = 'dashboard-card';
    card.style.cssText = 'grid-column:1/-1';
    card.innerHTML =
      '<div class="card-header"><h3>School Fees</h3><span class="card-icon">&#8373;</span></div>' +
      '<div class="card-body"><p style="font-size:.85rem;margin-bottom:.2rem">' + title + '</p>' +
      feeRows(Object.assign({ id: user.student.id }, user.student)) + '</div>';
    grid.appendChild(card);
  }

  function renderParent(user) {
    var target = document.querySelector('.fee-section');
    if (!target && !(user.children || []).length) return;
    var html = '<h3>Fee Payment</h3>';
    (user.children || []).forEach(function(child) {
      html += '<p style="margin:.35rem 0 .1rem;font-weight:600">' + esc(child.name) + ' &middot; ' + esc(child.level) + '</p>';
      html += feeRows(child);
    });
    if (target) target.innerHTML = html;
  }

  document.addEventListener('mec:user', function(e) {
    var user = e.detail;
    if (!user || !window.MEC) {
      // legacy placeholder session -> ignore
      return;
    }
    if (!document.getElementById('mec-fee-style')) {
      var s = document.createElement('style');
      s.id = 'mec-fee-style';
      s.textContent = STYLE;
      document.head.appendChild(s);
    }
    if (user.role === 'student') renderStudent(user);
    if (user.role === 'parent') renderParent(user);
  });

  document.addEventListener('click', function(e) {
    var btn = e.target;
    if (!btn || !btn.classList || !btn.classList.contains('pay-btn')) return;
    pay(btn.getAttribute('data-sid'), btn.getAttribute('data-fid'), btn);
  });

  try {
    if (document.readyState === 'ready' || document.readyState === 'complete') {
      document.dispatchEvent(new CustomEvent('mec:user-check'));
    }
  } catch (e) {}
})();