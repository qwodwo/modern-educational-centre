// Mobile Menu (slide-in drawer) + Nav Search + Site-wide Search + Header Info Bar
document.addEventListener('DOMContentLoaded', function() {
    const html = document.documentElement;
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navLinks = document.querySelector('.nav-links');
    const siteHeader = document.getElementById('siteHeader');

    // --- Mobile Menu: right-side slide-in drawer ---
    var backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.appendChild(backdrop);

    function setMenu(open) {
        if (!navLinks || !mobileMenuToggle) return;
        navLinks.classList.toggle('active', open);
        mobileMenuToggle.classList.toggle('active', open);
        mobileMenuToggle.setAttribute('aria-expanded', String(open));
        backdrop.classList.toggle('show', open);
        document.body.classList.toggle('menu-open', open);
        html.style.overflow = open ? 'hidden' : '';
    }

    if (mobileMenuToggle && navLinks) {
        mobileMenuToggle.addEventListener('click', function() {
            setMenu(!navLinks.classList.contains('active'));
        });

        backdrop.addEventListener('click', function() {
            setMenu(false);
        });

        document.querySelectorAll('.nav-links a').forEach(function(link) {
            link.addEventListener('click', function(e) {
                if (e.target.closest('.dropdown') && e.target === e.currentTarget && e.currentTarget.getAttribute('href') === '#') {
                    return; // dropdown parent is toggled by the + / - handler
                }
                setMenu(false);
            });
        });
    }

    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            setMenu(false);
        }
    });

    // --- Header Info Bar: show at top, collapse on scroll ---
    if (siteHeader) {
        function updateHeaderOnScroll() {
            var scrolled = window.scrollY > 10;
            siteHeader.classList.toggle('bar-hidden', scrolled);
            document.body.classList.toggle('nav-collapsed', scrolled);
        }
        window.addEventListener('scroll', updateHeaderOnScroll, { passive: true });
        updateHeaderOnScroll();
    }

    // --- Mobile dropdown toggle (Student Zone) ---
    document.querySelectorAll('.dropdown > a').forEach(function(link) {
        link.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                var d = link.parentElement;
                var wasOpen = d.classList.contains('active');
                document.querySelectorAll('.dropdown.active').forEach(function(x) {
                    x.classList.remove('active');
                });
                if (!wasOpen) d.classList.add('active');
            }
        });
    });

    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown.active').forEach(function(x) {
                    x.classList.remove('active');
                });
            }
        }
    });

    // --- Site-wide search index ---
    var SITE_INDEX = [
        { url: 'index.html', title: 'Home', keywords: 'home welcome preschool kindergarten creche nursery day boarding quality education' },
        { url: 'about.html', title: 'About Us', keywords: 'about mission vision values history staff school overview' },
        { url: 'admissions.html', title: 'Admissions', keywords: 'admission apply enroll enrolment fees requirements forms application' },
        { url: 'academics.html', title: 'Academics', keywords: 'academics curriculum subjects junior high pre-k grades classes programmes learning' },
        { url: 'day-school.html', title: 'Day School', keywords: 'day school daily bus transport schedule transportation' },
        { url: 'boarding-life.html', title: 'Boarding Life', keywords: 'boarding hostel dorm dormitory residential life' },
        { url: 'gallery.html', title: 'Gallery', keywords: 'gallery photos pictures images campus tour' },
        { url: 'news.html', title: 'News & Events', keywords: 'news events calendar activities updates announcements' },
        { url: 'contact.html', title: 'Contact Us', keywords: 'contact phone email address locate visit reach' },
        { url: 'auth/login.html', title: 'Portals', keywords: 'login portal register student parent staff sign in account' }
    ];

    // Returns the right relative URL to a page from the current page
    function pageUrl(file) {
        var here = window.location.pathname;
        var inSub = /\/auth\//.test(here) || /^auth\//.test(here);
        return (inSub ? '../' : '') + file;
    }

    // --- Search helpers ---
    function findSections() {
        return document.querySelectorAll('main section, main .section-container');
    }

    function highlightOnPage(term) {
        var textLower = term.toLowerCase();
        var sections = findSections();
        var count = 0;
        var firstSection = null;

        sections.forEach(function(sec) {
            var txt = (sec.textContent || '').toLowerCase();
            if (txt.indexOf(textLower) !== -1) {
                count++;
                if (!firstSection) firstSection = sec;
            }
        });

        if (count > 0 && firstSection) {
            firstSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            firstSection.style.outline = '3px solid var(--accent-color)';
            firstSection.style.outlineOffset = '4px';
            setTimeout(function() {
                firstSection.style.outline = '';
                firstSection.style.outlineOffset = '';
            }, 3000);
            showSearchStatus('Found ' + count + ' match' + (count > 1 ? 'es' : '') + ' for "' + term + '" on this page.');
            return true;
        }
        return false;
    }

    function searchSites(term) {
        var tokens = term.toLowerCase().split(/\s+/).filter(Boolean);
        var best = null;
        var bestScore = 0;
        SITE_INDEX.forEach(function(page) {
            var score = 0;
            var kw = page.keywords.toLowerCase();
            tokens.forEach(function(t) {
                if (kw.indexOf(t) !== -1) score++;
            });
            if (score > bestScore) {
                bestScore = score;
                best = page;
            }
        });
        return bestScore > 0 ? best : null;
    }

    var searchStatusTimer = null;
    function showSearchStatus(msg) {
        var box = document.getElementById('navSearch');
        if (!box) return;
        var status = box.querySelector('.search-status');
        if (!status) {
            status = document.createElement('div');
            status.className = 'search-status';
            box.appendChild(status);
        }
        status.textContent = msg;
        clearTimeout(searchStatusTimer);
        searchStatusTimer = setTimeout(function() {
            if (status && status.parentNode) status.parentNode.removeChild(status);
        }, 4000);
    }

    // --- Search Toggle ---
    var searchToggle = document.getElementById('searchToggle');
    var navSearch = document.getElementById('navSearch');

    function closeSearch() {
        if (navSearch) navSearch.classList.remove('open');
    }

    if (searchToggle && navSearch) {
        searchToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            navSearch.classList.toggle('open');
            if (navSearch.classList.contains('open')) {
                var input = navSearch.querySelector('input[type="search"]');
                if (input) setTimeout(function() { input.focus(); }, 50);
            }
        });

        document.addEventListener('click', function(e) {
            if (!navSearch.contains(e.target) && e.target !== searchToggle) {
                closeSearch();
            }
        });

        var searchForm = navSearch.querySelector('form');
        if (searchForm) {
            searchForm.addEventListener('submit', function(e) {
                e.preventDefault();
                var input = navSearch.querySelector('input[type="search"]');
                var term = input ? input.value.trim() : '';
                if (!term) return;

                if (highlightOnPage(term)) {
                    closeSearch();
                    if (input) input.value = '';
                    return;
                }

                var best = searchSites(term);
                if (best) {
                    window.location.href = pageUrl(best.url) + '?q=' + encodeURIComponent(term);
                } else {
                    showSearchStatus('No results found for "' + term + '". Try words like "academics", "boarding" or "contact".');
                }
            });

            // Escape closes search
            var input = navSearch.querySelector('input[type="search"]');
            if (input) {
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') closeSearch();
                });
            }
        }
    }

    // --- Auto-highlight search results on page load (?q=term) ---
    function readQueryParam(name) {
        var m = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
        return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
    }

    var q = readQueryParam('q');
    if (q) {
        setTimeout(function() { highlightOnPage(q); }, 350);
    }

    // --- Footer contact form -> submits via mailto ---
    var footerForms = document.querySelectorAll('.footer-form');
    for (var i = 0; i < footerForms.length; i++) {
        footerForms[i].addEventListener('submit', function(e) {
            e.preventDefault();
            var f = e.target;
            var name = f.querySelector('input[name="name"]').value.trim();
            var email = f.querySelector('input[name="email"]').value.trim();
            var msg = f.querySelector('textarea[name="message"]').value.trim();
            if (!name || !email || !msg) return;
            var subject = encodeURIComponent('Website enquiry from ' + name);
            var body = encodeURIComponent('Name: ' + name + ' | Email: ' + email + '\n\n' + msg);
            window.location.href = 'mailto:moderneducentre@gmail.com?subject=' + subject + '&body=' + body;
        });
    }
});