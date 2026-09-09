// Application engine - submits the admission form to /api/applications
(function() {
  var GUARDIAN_HTML =
    '<div class="form-group">' +
    '  <label>Parent/Guardian Full Name</label>' +
    '  <input type="text" id="g-name" name="guardianName" required placeholder="e.g. Yaw Boateng" maxlength="80">' +
    '</div>' +
    '<div class="form-group">' +
    '  <label>Parent/Guardian Email</label>' +
    '  <input type="email" id="g-email" name="guardianEmail" required placeholder="you@example.com" maxlength="120">' +
    '</div>' +
    '<div class="form-group">' +
    '  <label>Parent/Guardian Phone</label>' +
    '  <input type="tel" id="g-phone" name="guardianPhone" placeholder="+233 ..." maxlength="20">' +
    '</div>';

  function showStatus(form, ok, text) {
    var box = document.getElementById('app-form-status');
    if (!box) {
      box = document.createElement('div');
      box.id = 'app-form-status';
      box.style.cssText = 'margin-top:1rem;padding:0.8rem 1rem;border-radius:8px;font-weight:600;';
      form.appendChild(box);
    }
    box.style.display = 'block';
    box.style.background = ok ? '#e6ffed' : '#ffe6e6';
    box.style.color = ok ? '#14532d' : '#7f1d1d';
    box.textContent = text;
  }

  // Read a field by name first (scoped to root), falling back to a positional selector.
  function get(root, name, fallback) {
    if (name) {
      var named = root.querySelector('[name="' + name + '"]');
      if (named) return named;
    }
    return fallback ? root.querySelector(fallback) : null;
  }

  function val(root, name, fallback) {
    var el = get(root, name, fallback);
    return el ? el.value.trim() : '';
  }

  function checked(root, name, legacy) {
    var el = root.querySelector('input[name="' + name + '"]:checked');
    if (!el && legacy) el = root.querySelector(legacy + ':checked');
    return el ? el.value : '';
  }

  function readDocs(fileInput) {
    var files = Array.from(fileInput && fileInput.files ? fileInput.files : []).slice(0, 3);
    return Promise.all(files.map(function(file) {
      return new Promise(function(resolve) {
        var reader = new FileReader();
        reader.onload = function() {
          resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: String(reader.result || '').split(',')[1] || '' });
        };
        reader.onerror = function() { resolve(null); };
        reader.readAsDataURL(file);
      });
    })).then(function(list) { return list.filter(Boolean); });
  }

  document.addEventListener('DOMContentLoaded', function() {
    var form = document.getElementById('applicationForm');
    if (!form) return;

    // add guardian contact block only if the markup does not already include one
    if (!form.querySelector('[name="guardianName"]')) {
      var guardian = document.createElement('div');
      guardian.innerHTML = '<h3 style="margin:.5rem 0">Parent/Guardian Contact</h3>' + GUARDIAN_HTML;
      form.appendChild(guardian);
    }

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var active = form.querySelector('.tab-content.active');
      if (!active) { showStatus(form, false, 'Please select a programme tab.'); return; }
      var isBoarding = active.id === 'boarding-tab';

      var gName = val(form, 'guardianName');
      var gEmail = val(form, 'guardianEmail');
      var gPhone = val(form, 'guardianPhone');
      if (gName === '' && document.getElementById('g-name')) gName = document.getElementById('g-name').value.trim();
      if (gEmail === '' && document.getElementById('g-email')) gEmail = document.getElementById('g-email').value.trim();
      if (gPhone === '' && document.getElementById('g-phone')) gPhone = document.getElementById('g-phone').value.trim();
      if (!gName || !gEmail) { showStatus(form, false, 'Please provide the parent/guardian name and email.'); return; }

      var house = val(active, 'house');
      var medical = val(active, 'medicalNotes', 'textarea');
      var statement = val(active, 'guardianStatement');
      var orientation = val(active, 'orientation');
      if (!isBoarding && orientation === '' && active.querySelectorAll('select')[1]) orientation = active.querySelectorAll('select')[1].value;

      var app = {
        stream: isBoarding ? 'boarding' : 'day',
        studentName: val(active, 'studentName', 'input[type="text"]'),
        dob: val(active, 'dob', 'input[type="date"]'),
        gradeLevel: val(active, 'gradeLevel', 'select'),
        humanGrade: null,
        house: house,
        boardingType: isBoarding ? checked(active, 'boardingType', 'input[name="boarding-type"]') : '',
        medicalNotes: isBoarding ? medical : '',
        guardianStatement: isBoarding ? statement : '',
        orientation: !isBoarding ? orientation : '',
        transport: !isBoarding ? checked(active, 'transport') : '',
        programme: Array.from(active.querySelectorAll('input[name="programme"]:checked')).map(function(c) { return c.value; }),
        guardianName: gName,
        guardianEmail: gEmail,
        guardianPhone: gPhone,
        documents: []
      };

      var fileInput = active.querySelector('input[type="file"]');
      var btn = form.querySelector('button[type="submit"]');
      var original = btn && btn.textContent ? btn.textContent : '';

      showStatus(form, false, 'Sending application...');
      if (btn) btn.disabled = true;

      readDocs(fileInput).then(function(docs) {
        app.documents = docs;
        return fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(app)
        }).then(function(r) { return r.json(); });
      }).then(function(res) {
        if (res && res.ok && res.application) {
          showStatus(form, true, 'Application sent. Reference: ' + res.application.ref + '. Our admissions team will contact you by email with the next steps.');
          form.reset();
        } else {
          showStatus(form, false, (res && res.error) || 'Could not send the application. Please try again.');
        }
      }).catch(function() {
        showStatus(form, false, 'Network error. Please check your connection and try again.');
      }).then(function() {
        if (btn) { btn.disabled = false; btn.textContent = original || 'Submit Application'; }
      });
    });
  });
})();