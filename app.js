/* App-like mobile behaviour shared by every page (visual only, no content). */
(function () {
    var root = document.documentElement;
    var header = document.querySelector('.site-header');
    var nav = document.getElementById('navLinks');
    var toggle = document.getElementById('navToggle');

    // Header height drives the full-screen menu sheet size.
    function setHeaderHeight() {
        if (header) root.style.setProperty('--hdr-h', header.offsetHeight + 'px');
    }
    setHeaderHeight();
    window.addEventListener('resize', setHeaderHeight, { passive: true });

    // Lock page scroll while the menu sheet is open; close it with Escape.
    if (nav) {
        new MutationObserver(function () {
            document.body.classList.toggle('nav-open', nav.classList.contains('open'));
        }).observe(nav, { attributes: true, attributeFilter: ['class'] });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && nav.classList.contains('open') && toggle) toggle.click();
        });
    }

    // Compact header once the page has scrolled.
    var ticking = false;
    window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
            document.body.classList.toggle('is-scrolled', window.scrollY > 8);
            ticking = false;
        });
    }, { passive: true });
})();
