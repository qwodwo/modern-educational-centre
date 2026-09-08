// Phase 4: application engine - submits the index.html "Apply Now" form to /api/applications
(function() {
  var GUARDIAN_HTML =
    '<div class="form-group">' +
    '  <label>Parent/Guardian Full Name</label>' +
    '  <input type="text" id="g-name" required placeholder="e.g. Yaw Boateng">' +
    '</div>' +
    '<div class="form-group">' +
    '  <label>Parent/Guardian Email</label>' +
    '  <input type="email" id="g-email" required placeholder="you@example.com">' +
    '</div>' +
    '<div class="form-group">' +
    '  <label>Parent/Guardian Phone</label>' +
    '  <input type="tel" id="g-phone" placeholder="+233 ...">' +
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

  function val(sel, tab) {
    var el = tab.querySelector(sel);
    return el ? el.value.trim() : '';
  }

  function checked(groupName, tab) {
    var el = tab.querySelector('input[name="' + groupName + '"]:checked');
    return el ? el.value : '';
  }

  function readDocs(fileInput) {
    var files = Array.from(fileInput.files || []).slice(0, 3);
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

    // add guardian contact block (single, shown for both tabs)
    if (!document.getElementById('g-name')) {
      var guardian = document.createElement('div');
      guardian.innerHTML = '<h3 style="margin:.5rem 0">Parent/Guardian Contact</h3>' + GUARDIAN_HTML;
      form.appendChild(guardian);
    }

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var active = form.querySelector('.tab-content.active');
      if (!active) { showStatus(form, false, 'Please select a programme tab.'); return; }
      var isBoarding = active.id === 'boarding-tab';

      var gName = val('#g-name', form);
      var gEmail = val('#g-email', form);
      var gPhone = val('#g-phone', form);
      if (!gName || !gEmail) { showStatus(form, false, 'Please provide the parent/guardian name and email.'); return; }

      var app = {
        stream: isBoarding ? 'boarding' : 'day',
        studentName: val('input[type="text"]', active),
        dob: val('input[type="date"]', active),
        gradeLevel: val('select', active),
        humanGrade: null,
        house: isBoarding ? val('select:nth-of-type(2)', active) : '',
        boardingType: isBoarding ? checked('boarding-type', active) : '',
        medicalNotes: isBoarding ? (active.querySelectorAll('textarea')[0] || {}).value || '' : '',
        guardianStatement: isBoarding ? (active.querySelectorAll('textarea')[1] || {}).value || '' : '',
        orientation: !isBoarding ? active.querySelectorAll('select')[1].value : '',
        transport: !isBoarding ? checked('transport', active) : '',
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