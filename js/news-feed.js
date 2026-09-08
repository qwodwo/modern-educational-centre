// Phase 4: renders published CMS news + upcoming events on the public News page (additive)
(function() {
  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html) node.innerHTML = html;
    return node;
  }

  function load() {
    var container = document.getElementById('cms-news-list');
    if (!container) return;
    Promise.all([
      fetch('/api/news').then(function(r) { return r.json(); }),
      fetch('/api/events').then(function(r) { return r.json(); })
    ]).then(function(results) {
      var news = results[0].news || [];
      var events = results[1].events || [];
      if (!news.length && !events.length) {
        container.innerHTML = '<p style="opacity:.75">New updates will appear here once published from the Administration panel.</p>';
        return;
      }
      container.innerHTML = '';

      events.forEach(function(ev) {
        var card = el('div', 'news-item');
        card.innerHTML =
          '<h4 class="news-date">' + ev.date + (ev.time ? ' &middot; ' + ev.time : '') + '</h4>' +
          '<h3>' + ev.title + '</h3>' +
          '<p>' + (ev.description || '') + '</p>';
        if (ev.location) card.innerHTML += '<p style="font-size:.85rem;opacity:.8"><strong>Location:</strong> ' + ev.location + '</p>';
        container.appendChild(card);
      });

      news.forEach(function(n) {
        var card = el('div', 'news-item');
        card.innerHTML =
          '<h4 class="news-date">' + n.date + ' &middot; ' + (n.category || 'General') + '</h4>' +
          '<h3>' + n.title + '</h3>' +
          '<p>' + (n.excerpt || '') + '</p>' +
          (n.body ? '<p class="read-more-link" style="font-size:.9rem">' + n.body + '</p>' : '');
        container.appendChild(card);
      });
    }).catch(function() {
      container.innerHTML = '<p style="opacity:.75">Could not load the latest updates.</p>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();