// Fillable Admission Form PDF generator (uses jsPDF from CDN)
(function() {
  var NAVY = { r: 26, g: 42, b: 74 };
  var INK = { r: 17, g: 24, b: 39 };
  var FADED = { r: 100, g: 116, b: 139 };
  var LIGHT = { r: 237, g: 242, b: 248 };
  var ACCENT = { r: 59, g: 130, b: 246 };

  function styleField(f) {
    f.fontSize = 10;
    f.textColor = '1,17,24,39';
    f.borderColor = '150,162,180';
    f.fillColor = '250,251,253';
    f.background = '250,251,253';
    return f;
  }

  function build() {
    var A = window.jspdf.jsPDF.AcroForm;
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    var W = 210;
    var margin = 18;
    var usable = W - margin * 2;
    var y = 0;
    var fseq = 0;

    function nextName(base) { fseq += 1; return base + '_' + fseq; }

    function sectionTitle(text) {
      y += 5;
      doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
      doc.rect(margin - 2, y, usable + 4, 7.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(text.toUpperCase(), margin, y + 5.2);
      doc.setTextColor(INK.r, INK.g, INK.b);
      doc.setFont('helvetica', 'normal');
      y += 9;
    }

    function label(text, forcePage) {
      if (forcePage !== false) { y += 1.5; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(INK.r, INK.g, INK.b);
      doc.text(text, margin, y);
      doc.setFont('helvetica', 'normal');
      y += 4.6;
    }

    function ensure(h) {
      var pageH = doc.internal.pageSize.getHeight();
      if (y + h > pageH - 16) { doc.addPage(); y = 16; }
    }

    function field(labelText, w, h, make, width) {
      ensure(h + 8);
      label(labelText);
      var ww = width || usable;
      var f = make();
      var height = h == null ? 7 : h;
      f.x = margin;
      f.y = y;
      f.width = ww;
      f.height = height;
      f.fieldName = nextName(labelText.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
      doc.addField(f);
      y += height + 1.6;
      return f;
    }

    function twoUp(l1, w1, make1, l2, w2, make2) {
      ensure(14);
      var gap = 6;
      var h = 7;
      label(l1);
      var f1 = make1();
      Object.assign(f1, { x: margin, y: y, width: w1, height: h });
      f1.fieldName = nextName(l1.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
      doc.addField(f1);
      label(l2);
      var f2 = make2();
      Object.assign(f2, { x: margin + w1 + gap, y: y, width: w2, height: h });
      f2.fieldName = nextName(l2.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
      doc.addField(f2);
      y += h + 1.6;
      return [f1, f2];
    }

    function checkRow(text) {
      ensure(8);
      var box = new A.CheckBox();
      var boxSize = 4.6;
      box.x = margin;
      box.y = y - 3.4;
      box.width = boxSize;
      box.height = boxSize;
      box.value = 'Yes';
      box.fieldName = nextName('ck');
      doc.addField(box);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(INK.r, INK.g, INK.b);
      doc.text(text, margin + 7, y);
      y += 6.6;
    }

    function textField(opts) {
      var f = new A.TextField();
      styleField(f);
      if (opts.value) f.value = opts.value;
      if (opts.placeholder) f.toolbarText = opts.placeholder;
      if (opts.multiline) { f.multiline = true; }
      if (opts.maxLength) f.maxLength = opts.maxLength;
      return f;
    }

    function comboField(options) {
      var f = new A.ComboBox();
      styleField(f);
      f.options = options || [];
      return f;
    }

    // ---- Page 1: header ----
    doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    doc.rect(0, 0, W, 30, 'F');
    doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.rect(0, 30, W, 1.6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('MODERN EDUCATIONAL CENTRE', margin, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('Preschool | Primary School | Junior High School', margin, 17.5);
    doc.setFontSize(8);
    doc.text('CC Bruce Road, Sahara-Dansoman  |  P.O. Box 124, Abuakwa-Sepaase, Kumasi  |  +233 249458552', margin, 22.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('ADMISSION APPLICATION FORM', margin, 28.6);
    doc.setFont('helvetica', 'normal');

    y = 36;
    doc.setFontSize(8.5);
    doc.setTextColor(FADED.r, FADED.g, FADED.b);
    doc.text('This is a fillable form. Type into the highlighted boxes, tick the checkboxes, then print, sign and submit.', 18, y);
    y += 5;

    // ---- Student Information ----
    sectionTitle('Section 1 - Student Information');
    twoUp('Student\'s Full Name (first & surname)', 110, function() { return textField({ placeholder: 'e.g. Kwame Mensah' }); },
      'Date of Birth (DD/MM/YYYY)', 60, function() { return textField({ placeholder: 'e.g. 12/05/2015' }); });
    twoUp('Gender', 60, function() { return textField({ placeholder: 'Male / Female' }); },
      'Grade / Class Applying For', 110, function() { return comboField(['Select grade', 'Preschool', 'Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8']); });

    sectionTitle('Section 2 - Programme Interest');
    checkRow('Early Years (Preschool - Kindergarten)');
    checkRow('Primary School (Grades 1 - 5)');
    checkRow('Junior High School (Grades 6 - 8)');
    checkRow('Boarding (Grades 4 - 8)');

    // ---- Day School ----
    sectionTitle('Section 3 - Day School (if applicable)');
    checkRow('Yes - school bus transportation is needed');
    checkRow('No - the family provides its own transportation');
    checkRow('Yes - the student has attended our orientation');
    checkRow('No - the student has not attended orientation');

    // ---- Boarding ----
    sectionTitle('Section 4 - Boarding (if applicable)');
    field('Preferred Boarding House', 110, 7, function() {
      return comboField(['Select house', "Boys' Primary House", "Boys' High School House", "Girls' Primary House", "Girls' High School House"]);
    }, 110);
    checkRow('Full Boarding (5 - 7 days/week)');
    checkRow('Weekly Boarding (Monday - Friday)');
    field('Any medical conditions or allergies?', null, 22, function() {
      var f = textField({ multiline: true, placeholder: 'Please describe any conditions, medications or allergies' });
      return f;
    });
    field('Parent/Guardian statement for boarding', null, 22, function() {
      return textField({ multiline: true, placeholder: 'Why do you choose boarding education for your child?' });
    });

    doc.addPage();
    y = 16;

    // ---- Required documents ----
    sectionTitle('Section 5 - Required Documents Checklist');
    checkRow('Birth Certificate');
    checkRow('Passport Photos (recent)');
    checkRow('Previous School Reports');
    checkRow('Medical / Immunization Records');

    // ---- Parent/Guardian ----
    sectionTitle('Section 6 - Parent / Guardian Information');
    twoUp('Full Name', 110, function() { return textField({ placeholder: 'e.g. Yaw Boateng' }); },
      'Relationship to Student', 60, function() { return textField({ placeholder: 'e.g. Mother/Father' }); });
    twoUp('Email Address', 110, function() { return textField({ placeholder: 'you@example.com' }); },
      'Phone Number', 60, function() { return textField({ placeholder: '+233 ...' }); });
    field('Home Address', null, 7, function() { return textField({ placeholder: 'House number, street, city/region' }); });

    // ---- Declaration ----
    sectionTitle('Section 7 - Declaration');
    ensure(10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(INK.r, INK.g, INK.b);
    var decl = 'I confirm that the information provided is true and accurate, and I apply for admission of the above-named student to Modern Educational Centre. I accept the admission policies and agree that the school may contact me using the details provided.';
    var lines = doc.splitTextToSize(decl, usable);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
    checkRow('I agree to the declaration above');
    ensure(14);
    label('');
    var sig1 = new A.TextField();
    Object.assign(styleField(sig1), { x: margin, y: y, width: 100, height: 8 });
    sig1.toolbarText = 'Type name (acts as signature)';
    sig1.fieldName = nextName('signature');
    doc.addField(sig1);
    var sig2 = new A.TextField();
    Object.assign(styleField(sig2), { x: margin + 112, y: y, width: 62, height: 8 });
    sig2.placeholder = 'DD/MM/YYYY';
    sig2.fieldName = nextName('date');
    doc.addField(sig2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Parent / Guardian Signature', margin - 0.4, y - 2);
    doc.text('Date', margin + 112, y - 2);
    y += 14;

    // footer
    var pageH = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(FADED.r, FADED.g, FADED.b);
    var foot = 'Please submit the completed form with supporting documents to the school office or email moderneducentre@gmail.com.';
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.text('Modern Educational Centre - NO KNOWLEDGE, NO SUCCESS - Page ' + i + ' of ' + n, W / 2, pageH - 8, { align: 'center' });
    }

    doc.setProperties({
      title: 'Modern Educational Centre - Admission Application Form'
    });
    doc.save('Modern-Educational-Centre-Admission-Form.pdf');
  }

  function wire() {
    var btn = document.getElementById('downloadPdfBtn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      if (!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.AcroForm) {
        alert('The PDF generator could not be loaded. Please check your internet connection and try again.');
        return;
      }
      try {
        btn.disabled = true;
        btn.textContent = 'Preparing PDF...';
        setTimeout(function() {
          build();
          btn.disabled = false;
          btn.textContent = 'Download PDF';
        }, 30);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Download PDF';
        alert('Could not generate the PDF: ' + (err && err.message ? err.message : 'unknown error'));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();