/* ==========================================================================
   Free SEO Checker — client-side SEO audit engine
   Vanilla JS. No external libraries. Parses HTML via DOMParser (never executed
   as live code) and renders all results with textContent to prevent XSS.
   ========================================================================== */

(function () {
    'use strict';

    var CIRCUMFERENCE = 439.8; // 2 * PI * 70 (matches SVG radius in CSS/HTML)
    var FETCH_TIMEOUT_MS = 10000;
    var STOPWORDS = ('the a an and or but is are was were be been being of in on at to for with '
        + 'as by from up about into over after under again further then once here there when '
        + 'where why how all any both each few more most other some such no nor not only own '
        + 'same so than too very s t can will just don should now this that these those i you '
        + 'he she it we they what which who whom your our their his her its').split(' ');

    var CATEGORY_WEIGHTS = {
        technical: 20,
        onpage: 20,
        content: 15,
        images: 10,
        links: 10,
        schema: 15,
        social: 10
    };

    var CATEGORY_META = {
        technical: { label: 'Technical SEO', icon: 'icon-sliders' },
        onpage: { label: 'On-Page SEO', icon: 'icon-type' },
        content: { label: 'Content SEO', icon: 'icon-file-text' },
        images: { label: 'Images', icon: 'icon-image' },
        links: { label: 'Links', icon: 'icon-link-2' },
        schema: { label: 'Schema', icon: 'icon-code' },
        social: { label: 'Social SEO', icon: 'icon-share-2' }
    };

    var GROUP_ORDER = ['meta', 'headings', 'content', 'images', 'links', 'technical', 'structured'];
    var GROUP_META = {
        meta: { label: 'Meta SEO', icon: 'icon-type' },
        headings: { label: 'Heading Structure', icon: 'icon-type' },
        content: { label: 'Content', icon: 'icon-file-text' },
        images: { label: 'Images', icon: 'icon-image' },
        links: { label: 'Links', icon: 'icon-link-2' },
        technical: { label: 'Technical SEO', icon: 'icon-sliders' },
        structured: { label: 'Structured Data', icon: 'icon-code' }
    };

    // -----------------------------------------------------------------
    // DOM refs
    // -----------------------------------------------------------------
    var tabUrlBtn = document.getElementById('tabUrlBtn');
    var tabHtmlBtn = document.getElementById('tabHtmlBtn');
    var panelUrl = document.getElementById('panelUrl');
    var panelHtml = document.getElementById('panelHtml');

    var urlForm = document.getElementById('urlForm');
    var htmlForm = document.getElementById('htmlForm');
    var urlInput = document.getElementById('urlInput');
    var urlInputError = document.getElementById('urlInputError');
    var htmlInput = document.getElementById('htmlInput');
    var htmlInputError = document.getElementById('htmlInputError');
    var keywordInputUrl = document.getElementById('keywordInputUrl');
    var keywordInputHtml = document.getElementById('keywordInputHtml');
    var whatsappInputUrl = document.getElementById('whatsappInputUrl');
    var whatsappInputUrlError = document.getElementById('whatsappInputUrlError');
    var whatsappInputHtml = document.getElementById('whatsappInputHtml');
    var whatsappInputHtmlError = document.getElementById('whatsappInputHtmlError');

    var analyzeUrlBtn = document.getElementById('analyzeUrlBtn');
    var analyzeHtmlBtn = document.getElementById('analyzeHtmlBtn');

    var seoLoading = document.getElementById('seoLoading');
    var seoLoadingText = document.getElementById('seoLoadingText');
    var seoNotice = document.getElementById('seoNotice');

    var resultsSection = document.getElementById('resultsSection');
    var scoreArc = document.getElementById('scoreArc');
    var scoreNumber = document.getElementById('scoreNumber');
    var scoreVerdictBadge = document.getElementById('scoreVerdictBadge');
    var scoreVerdictText = document.getElementById('scoreVerdictText');
    var scoreTargetLabel = document.getElementById('scoreTargetLabel');
    var countPassed = document.getElementById('countPassed');
    var countWarnings = document.getElementById('countWarnings');
    var countErrors = document.getElementById('countErrors');
    var segPass = document.getElementById('segPass');
    var segWarn = document.getElementById('segWarn');
    var segError = document.getElementById('segError');
    var categoryGrid = document.getElementById('categoryGrid');

    var serpSiteName = document.getElementById('serpSiteName');
    var serpUrl = document.getElementById('serpUrl');
    var serpTitle = document.getElementById('serpTitle');
    var serpDescription = document.getElementById('serpDescription');

    var keywordCard = document.getElementById('keywordCard');
    var keywordEcho = document.getElementById('keywordEcho');
    var keywordChecks = document.getElementById('keywordChecks');

    var checksGroups = document.getElementById('checksGroups');

    if (!urlForm || !htmlForm) return;

    // -----------------------------------------------------------------
    // Tabs
    // -----------------------------------------------------------------
    function activateTab(which) {
        var urlActive = which === 'url';
        tabUrlBtn.classList.toggle('active', urlActive);
        tabHtmlBtn.classList.toggle('active', !urlActive);
        tabUrlBtn.setAttribute('aria-selected', String(urlActive));
        tabHtmlBtn.setAttribute('aria-selected', String(!urlActive));
        panelUrl.hidden = !urlActive;
        panelHtml.hidden = urlActive;
        hideNotice();
        whatsappInputUrl.classList.remove('invalid');
        whatsappInputUrlError.style.display = 'none';
        whatsappInputHtml.classList.remove('invalid');
        whatsappInputHtmlError.style.display = 'none';
    }

    tabUrlBtn.addEventListener('click', function () { activateTab('url'); });
    tabHtmlBtn.addEventListener('click', function () { activateTab('html'); });

    // -----------------------------------------------------------------
    // Notice / loading helpers
    // -----------------------------------------------------------------
    function showNotice(message, type) {
        seoNotice.textContent = message;
        seoNotice.className = 'form-status seo-notice ' + (type || 'error');
        seoNotice.hidden = false;
    }

    function hideNotice() {
        seoNotice.hidden = true;
        seoNotice.textContent = '';
    }

    function showCorsFailureNotice(targetUrl) {
        seoNotice.textContent = '';
        seoNotice.className = 'form-status seo-notice error';
        seoNotice.hidden = false;

        var p = document.createElement('p');
        p.className = 'seo-notice-text';
        p.textContent = 'This website does not allow direct browser analysis. Please use the HTML analysis option, or send us your website link on WhatsApp and we’ll check it manually.';
        seoNotice.appendChild(p);

        var waMessage = 'Hi! I tried to check my website ' + targetUrl + ' with the Free SEO Checker but it couldn’t be analyzed directly. Can you help me with a manual SEO audit?';
        var waLink = document.createElement('a');
        waLink.className = 'btn btn-primary btn-sm seo-notice-wa-btn';
        waLink.href = 'https://wa.me/94778064714?text=' + encodeURIComponent(waMessage);
        waLink.target = '_blank';
        waLink.rel = 'noopener';
        waLink.innerHTML = '<svg class="icon"><use href="#icon-whatsapp"/></svg>';
        waLink.appendChild(document.createTextNode(' Send via WhatsApp'));
        seoNotice.appendChild(waLink);
    }

    function setLoading(isLoading, label) {
        seoLoading.hidden = !isLoading;
        if (label) seoLoadingText.textContent = label;
        analyzeUrlBtn.disabled = isLoading;
        analyzeHtmlBtn.disabled = isLoading;
    }

    // -----------------------------------------------------------------
    // Validation
    // -----------------------------------------------------------------
    function normalizeUrl(raw) {
        var value = raw.trim();
        if (!value) return null;
        if (!/^https?:\/\//i.test(value)) value = 'https://' + value;
        try {
            var parsed = new URL(value);
            if (!/^https?:$/.test(parsed.protocol)) return null;
            if (!parsed.hostname || parsed.hostname.indexOf('.') === -1) return null;
            return parsed;
        } catch (e) {
            return null;
        }
    }

    function isValidWhatsapp(raw) {
        var digits = (raw || '').replace(/[^0-9+]/g, '');
        return /^\+?[0-9]{7,15}$/.test(digits);
    }

    // -----------------------------------------------------------------
    // Lead capture: emails the WhatsApp number + target to contact@seoservice.lk
    // via a small server-side mail script. Fire-and-forget — never blocks
    // or fails the on-screen analysis, since that must still run either way.
    // -----------------------------------------------------------------
    function sendLeadEmail(whatsapp, mode, urlOrNote, keyword) {
        var formData = new FormData();
        formData.append('whatsapp', whatsapp);
        formData.append('mode', mode);
        formData.append('url', urlOrNote || '');
        formData.append('keyword', keyword || '');

        fetch('seo-checker-lead.php', { method: 'POST', body: formData }).catch(function () {
            // Silently ignore — e.g. running from a local file:// page with no PHP backend.
        });
    }

    // -----------------------------------------------------------------
    // Form handlers
    // -----------------------------------------------------------------
    urlForm.addEventListener('submit', function (e) {
        e.preventDefault();
        hideNotice();
        urlInput.classList.remove('invalid');
        urlInputError.style.display = 'none';
        whatsappInputUrl.classList.remove('invalid');
        whatsappInputUrlError.style.display = 'none';

        var parsed = normalizeUrl(urlInput.value);
        if (!parsed) {
            urlInput.classList.add('invalid');
            urlInputError.style.display = 'block';
            return;
        }

        if (!isValidWhatsapp(whatsappInputUrl.value)) {
            whatsappInputUrl.classList.add('invalid');
            whatsappInputUrlError.style.display = 'block';
            return;
        }

        sendLeadEmail(whatsappInputUrl.value.trim(), 'url', parsed.href, keywordInputUrl.value.trim());
        analyzeFromUrl(parsed, keywordInputUrl.value.trim());
    });

    htmlForm.addEventListener('submit', function (e) {
        e.preventDefault();
        hideNotice();
        htmlInput.classList.remove('invalid');
        htmlInputError.style.display = 'none';
        whatsappInputHtml.classList.remove('invalid');
        whatsappInputHtmlError.style.display = 'none';

        var html = htmlInput.value;
        if (!html || html.trim().length < 20) {
            htmlInput.classList.add('invalid');
            htmlInputError.style.display = 'block';
            return;
        }

        if (!isValidWhatsapp(whatsappInputHtml.value)) {
            whatsappInputHtml.classList.add('invalid');
            whatsappInputHtmlError.style.display = 'block';
            return;
        }

        sendLeadEmail(whatsappInputHtml.value.trim(), 'html', '', keywordInputHtml.value.trim());
        analyzeFromHtml(html, keywordInputHtml.value.trim(), null);
    });

    // -----------------------------------------------------------------
    // Fetching (URL mode) — CORS-aware
    // -----------------------------------------------------------------
    function analyzeFromUrl(parsedUrl, keyword) {
        setLoading(true, 'Fetching and analyzing ' + parsedUrl.hostname + '…');
        resultsSection.hidden = true;

        var controller = ('AbortController' in window) ? new AbortController() : null;
        var timer = controller ? setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS) : null;

        fetch(parsedUrl.href, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller ? controller.signal : undefined })
            .then(function (res) {
                if (timer) clearTimeout(timer);
                if (!res.ok) {
                    throw new Error('HTTP ' + res.status);
                }
                return res.text();
            })
            .then(function (html) {
                setLoading(false);
                analyzeFromHtml(html, keyword, parsedUrl);
            })
            .catch(function () {
                if (timer) clearTimeout(timer);
                setLoading(false);
                showCorsFailureNotice(parsedUrl.href);
            });
    }

    // -----------------------------------------------------------------
    // Core analysis (works for both fetched pages and pasted HTML)
    // -----------------------------------------------------------------
    function analyzeFromHtml(html, keyword, sourceUrl) {
        setLoading(true, 'Analyzing page content…');

        // Small timeout so the loading state is visible even for instant (paste) analysis.
        setTimeout(function () {
            try {
                var doc = new DOMParser().parseFromString(html, 'text/html');
                var context = buildContext(doc, sourceUrl, html);
                var results = runAllChecks(context, keyword);
                renderResults(results, context, keyword);
                setLoading(false);
                resultsSection.hidden = false;
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (err) {
                setLoading(false);
                showNotice('Something went wrong while parsing this page: ' + err.message, 'error');
            }
        }, 250);
    }

    // -----------------------------------------------------------------
    // Build analysis context: resolves base host, body text, etc.
    // -----------------------------------------------------------------
    function buildContext(doc, sourceUrl, rawHtml) {
        var baseHref = null;
        var baseEl = doc.querySelector('base[href]');
        if (sourceUrl) {
            baseHref = sourceUrl.href;
        } else if (baseEl) {
            baseHref = baseEl.getAttribute('href');
        } else {
            var canonicalEl = doc.querySelector('link[rel="canonical"]');
            var ogUrlEl = doc.querySelector('meta[property="og:url"]');
            if (canonicalEl && canonicalEl.getAttribute('href')) baseHref = canonicalEl.getAttribute('href');
            else if (ogUrlEl && ogUrlEl.getAttribute('content')) baseHref = ogUrlEl.getAttribute('content');
        }

        var baseUrl = null;
        try { if (baseHref) baseUrl = new URL(baseHref); } catch (e) { baseUrl = null; }

        var bodyClone = doc.body ? doc.body.cloneNode(true) : null;
        if (bodyClone) {
            var stripSelectors = ['script', 'style', 'noscript', 'template'];
            stripSelectors.forEach(function (sel) {
                var nodes = bodyClone.querySelectorAll(sel);
                nodes.forEach(function (n) { n.remove(); });
            });
        }
        var bodyText = bodyClone ? (bodyClone.textContent || '') : '';
        bodyText = bodyText.replace(/\s+/g, ' ').trim();

        var paragraphs = doc.querySelectorAll('p');
        var firstParagraphText = '';
        for (var i = 0; i < paragraphs.length; i++) {
            var t = (paragraphs[i].textContent || '').replace(/\s+/g, ' ').trim();
            if (t.length > 20) { firstParagraphText = t; break; }
        }

        return {
            doc: doc,
            sourceUrl: sourceUrl,
            isUrlMode: !!sourceUrl,
            baseUrl: baseUrl,
            rawHtml: rawHtml,
            bodyText: bodyText,
            firstParagraphText: firstParagraphText,
            wordList: bodyText.length ? bodyText.toLowerCase().match(/[a-z0-9']+/g) || [] : []
        };
    }

    // -----------------------------------------------------------------
    // Check result factory
    // -----------------------------------------------------------------
    function check(id, group, category, weight, status, title, why, fix, detail) {
        return {
            id: id, group: group, category: category, weight: weight,
            status: status, // 'pass' | 'warn' | 'error' | 'na'
            title: title, why: why, fix: fix, detail: detail || null
        };
    }

    function countSyllables(word) {
        word = word.toLowerCase().replace(/[^a-z]/g, '');
        if (!word) return 0;
        if (word.length <= 3) return 1;
        word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
        word = word.replace(/^y/, '');
        var matches = word.match(/[aeiouy]{1,2}/g);
        return matches ? matches.length : 1;
    }

    // -----------------------------------------------------------------
    // Run all checks
    // -----------------------------------------------------------------
    function runAllChecks(ctx, keyword) {
        var doc = ctx.doc;
        var checks = [];

        // ---------------- META SEO (category: onpage) ----------------
        var titleEl = doc.querySelector('title');
        var titleText = titleEl ? titleEl.textContent.trim() : '';
        if (!titleText) {
            checks.push(check('title-exists', 'meta', 'onpage', 3, 'error',
                'Page Title Is Missing',
                'The <title> tag is one of the strongest on-page ranking signals and is what shows as the clickable headline in Google search results.',
                'Add a unique, descriptive <title> tag (50–60 characters) that includes your primary keyword near the front.'));
        } else {
            checks.push(check('title-exists', 'meta', 'onpage', 3, 'pass',
                'Page Title Exists',
                'Every indexable page should have a unique <title> tag.',
                'Keep it descriptive, unique per page, and aligned with search intent.', titleText));
            var tLen = titleText.length;
            if (tLen < 30) {
                checks.push(check('title-length', 'meta', 'onpage', 2, 'warn',
                    'Title Is Too Short (' + tLen + ' characters)',
                    'Short titles often under-use available space in search results and may not fully describe the page or include target keywords.',
                    'Expand your title to roughly 50–60 characters to better describe the page and improve click-through rate.'));
            } else if (tLen > 60) {
                checks.push(check('title-length', 'meta', 'onpage', 2, 'warn',
                    'Title Is Too Long (' + tLen + ' characters)',
                    'Google typically truncates titles beyond ~60 characters, which can cut off important keywords or calls to action.',
                    'Shorten your title to around 50–60 characters, keeping the most important words first.'));
            } else {
                checks.push(check('title-length', 'meta', 'onpage', 2, 'pass',
                    'Title Length Is Good (' + tLen + ' characters)',
                    'Titles between roughly 50–60 characters display fully in Google search results.',
                    'No action needed — keep future titles in this range.'));
            }
        }

        var metaDescEl = doc.querySelector('meta[name="description"]');
        var metaDescText = metaDescEl ? (metaDescEl.getAttribute('content') || '').trim() : '';
        if (!metaDescText) {
            checks.push(check('meta-desc-exists', 'meta', 'onpage', 3, 'error',
                'Meta Description Missing',
                'Your page does not contain a meta description.',
                'Add a unique 150–160 character description that clearly explains the page and encourages clicks.'));
        } else {
            checks.push(check('meta-desc-exists', 'meta', 'onpage', 3, 'pass',
                'Meta Description Exists',
                'A meta description gives search engines and users a summary of the page content.',
                'Keep it unique per page and written to encourage clicks.', metaDescText));
            var dLen = metaDescText.length;
            if (dLen < 70) {
                checks.push(check('meta-desc-length', 'meta', 'onpage', 2, 'warn',
                    'Meta Description Is Too Short (' + dLen + ' characters)',
                    'Very short descriptions waste available space in the search snippet and may look less compelling.',
                    'Expand your meta description to roughly 150–160 characters, summarizing the page and including a call to action.'));
            } else if (dLen > 160) {
                checks.push(check('meta-desc-length', 'meta', 'onpage', 2, 'warn',
                    'Meta Description Is Too Long (' + dLen + ' characters)',
                    'Google usually truncates descriptions beyond ~160 characters, which can cut off your message mid-sentence.',
                    'Trim your meta description to around 150–160 characters.'));
            } else {
                checks.push(check('meta-desc-length', 'meta', 'onpage', 2, 'pass',
                    'Meta Description Length Is Good (' + dLen + ' characters)',
                    'This length displays fully in most search results.',
                    'No action needed.'));
            }
        }

        var canonicalEl = doc.querySelector('link[rel="canonical"]');
        var canonicalHref = canonicalEl ? canonicalEl.getAttribute('href') : '';
        if (canonicalHref) {
            checks.push(check('canonical', 'meta', 'onpage', 2, 'pass',
                'Canonical URL Is Set',
                'A canonical tag tells search engines which URL is the authoritative version, preventing duplicate-content issues.',
                'Make sure it points to the correct, preferred URL for this page.', canonicalHref));
        } else {
            checks.push(check('canonical', 'meta', 'onpage', 2, 'warn',
                'Canonical URL Missing',
                'Without a canonical tag, search engines may treat similar or parameterized URLs as duplicate content and split ranking signals.',
                'Add <link rel="canonical" href="..."> pointing to the preferred URL of this page.'));
        }

        var robotsEl = doc.querySelector('meta[name="robots"]');
        var robotsContent = robotsEl ? (robotsEl.getAttribute('content') || '').toLowerCase() : '';
        if (robotsContent.indexOf('noindex') !== -1) {
            checks.push(check('robots-meta', 'meta', 'onpage', 2, 'error',
                'Page Is Set to "noindex"',
                'A noindex directive tells Google not to show this page in search results at all.',
                'Remove the noindex directive from the robots meta tag unless you deliberately want this page excluded from search.', robotsContent));
        } else if (robotsEl) {
            checks.push(check('robots-meta', 'meta', 'onpage', 2, 'pass',
                'Robots Meta Tag Allows Indexing',
                'The robots meta tag controls whether search engines can index and follow links on this page.',
                'No action needed — indexing is allowed.', robotsContent));
        } else {
            checks.push(check('robots-meta', 'meta', 'onpage', 2, 'pass',
                'No Restrictive Robots Meta Tag',
                'When absent, search engines default to "index, follow", which is correct for most public pages.',
                'Only add a robots meta tag if you need to restrict indexing.'));
        }

        var viewportEl = doc.querySelector('meta[name="viewport"]');
        if (viewportEl) {
            checks.push(check('viewport-meta', 'meta', 'onpage', 2, 'pass',
                'Viewport Meta Tag Present',
                'The viewport tag ensures your page scales correctly on mobile devices, a key ranking and usability factor.',
                'No action needed.', viewportEl.getAttribute('content')));
        } else {
            checks.push(check('viewport-meta', 'meta', 'onpage', 2, 'error',
                'Viewport Meta Tag Missing',
                'Without a viewport tag, mobile browsers may render your page at desktop width, hurting mobile usability and rankings.',
                'Add <meta name="viewport" content="width=device-width, initial-scale=1.0"> to the <head>.'));
        }

        // ---------------- HEADING STRUCTURE (category: onpage) ----------------
        var h1s = doc.querySelectorAll('h1');
        var h2s = doc.querySelectorAll('h2');
        var h3s = doc.querySelectorAll('h3');

        if (h1s.length === 0) {
            checks.push(check('h1-exists', 'headings', 'onpage', 3, 'error',
                'No H1 Tag Found',
                'The H1 heading tells both users and search engines the main topic of the page.',
                'Add a single, descriptive H1 that summarizes the page and includes your primary keyword.'));
        } else if (h1s.length === 1) {
            checks.push(check('h1-exists', 'headings', 'onpage', 3, 'pass',
                'Exactly One H1 Tag Found',
                'A single, clear H1 gives search engines an unambiguous signal about the page topic.',
                'No action needed.', h1s[0].textContent.trim()));
        } else {
            checks.push(check('h1-exists', 'headings', 'onpage', 3, 'warn',
                h1s.length + ' H1 Tags Found',
                'Multiple H1 tags can dilute topical relevance and confuse the page hierarchy, though modern Google handles this more leniently than in the past.',
                'Consider using a single H1 for the main page title, and H2/H3 for subsections.'));
        }

        checks.push(check('h2-count', 'headings', 'onpage', 1, h2s.length > 0 ? 'pass' : 'warn',
            h2s.length + ' H2 Tag' + (h2s.length === 1 ? '' : 's') + ' Found',
            'H2 tags break content into logical sections, improving readability and helping search engines understand page structure.',
            h2s.length > 0 ? 'No action needed.' : 'Add H2 subheadings to organize your content into clear sections.'));

        checks.push(check('h3-count', 'headings', 'onpage', 0, 'pass',
            h3s.length + ' H3 Tag' + (h3s.length === 1 ? '' : 's') + ' Found',
            'H3 tags provide further structure beneath H2 sections.',
            'Use H3s to break up long H2 sections when helpful — not required on every page.'));

        var headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
        var lastLevel = 0;
        var hierarchyIssue = false;
        headings.forEach(function (h) {
            var level = parseInt(h.tagName.substring(1), 10);
            if (lastLevel && level - lastLevel > 1) hierarchyIssue = true;
            lastLevel = level;
        });
        checks.push(check('heading-hierarchy', 'headings', 'onpage', 2, hierarchyIssue ? 'warn' : 'pass',
            hierarchyIssue ? 'Heading Levels Skip Unexpectedly' : 'Heading Hierarchy Looks Consistent',
            'Skipping heading levels (e.g. H2 straight to H4) can confuse screen readers and weaken the page’s semantic outline.',
            hierarchyIssue ? 'Reorder headings so levels descend one step at a time (H1 → H2 → H3).' : 'No action needed.'));

        // ---------------- CONTENT (category: content) ----------------
        var wordCount = ctx.wordList.length;
        var charCount = ctx.bodyText.length;
        var paragraphNodes = doc.querySelectorAll('p');
        var meaningfulParagraphs = 0;
        paragraphNodes.forEach(function (p) {
            if ((p.textContent || '').trim().length > 15) meaningfulParagraphs++;
        });

        if (wordCount < 300) {
            checks.push(check('word-count', 'content', 'content', 3, 'error',
                'Thin Content (' + wordCount + ' words)',
                'Pages with very little text often struggle to rank because they don’t give search engines enough context about the topic.',
                'Expand this page to at least 600+ words of unique, useful content covering the topic in depth.'));
        } else if (wordCount < 600) {
            checks.push(check('word-count', 'content', 'content', 3, 'warn',
                'Content Could Be More Comprehensive (' + wordCount + ' words)',
                'Longer, more thorough content tends to rank better for competitive keywords, though quality matters more than length alone.',
                'Consider expanding key sections with more detail, examples, or supporting data.'));
        } else {
            checks.push(check('word-count', 'content', 'content', 3, 'pass',
                'Good Content Length (' + wordCount + ' words)',
                'Sufficient content length gives search engines enough context to understand and rank the page.',
                'No action needed.'));
        }

        checks.push(check('char-count', 'content', 'content', 0, 'pass',
            charCount + ' Characters',
            'Character count is provided for reference alongside word count.',
            'Informational only — no action needed.'));

        checks.push(check('paragraph-count', 'content', 'content', 1, meaningfulParagraphs > 0 ? 'pass' : 'warn',
            meaningfulParagraphs + ' Paragraph' + (meaningfulParagraphs === 1 ? '' : 's') + ' Found',
            'Breaking content into paragraphs improves readability for both users and search engines.',
            meaningfulParagraphs > 0 ? 'No action needed.' : 'Structure your content into clear paragraphs rather than one large text block.'));

        var freq = {};
        ctx.wordList.forEach(function (w) {
            if (w.length < 3 || STOPWORDS.indexOf(w) !== -1) return;
            freq[w] = (freq[w] || 0) + 1;
        });
        var freqEntries = Object.keys(freq).map(function (w) { return [w, freq[w]]; }).sort(function (a, b) { return b[1] - a[1]; });
        var topWords = freqEntries.slice(0, 5);
        var stuffed = topWords.length && wordCount > 0 && (topWords[0][1] / wordCount) > 0.06;
        var topWordsDetail = topWords.map(function (e) { return e[0] + ' (' + e[1] + '×, ' + ((e[1] / (wordCount || 1)) * 100).toFixed(1) + '%)'; }).join(', ');
        checks.push(check('keyword-frequency', 'content', 'content', 2, stuffed ? 'warn' : 'pass',
            stuffed ? 'Possible Keyword Stuffing Detected' : 'Keyword Usage Looks Natural',
            'Repeating the same word excessively can look manipulative to search engines and hurts readability for users.',
            stuffed ? 'Reduce repetition of "' + topWords[0][0] + '" and use natural synonyms and related phrases instead.' : 'No action needed — avoid deliberately stuffing keywords regardless.',
            topWordsDetail || 'No significant repeated terms found.'));

        var sentenceCount = (ctx.bodyText.match(/[.!?]+(?:\s|$)/g) || []).length || (wordCount > 0 ? 1 : 0);
        if (wordCount < 100) {
            checks.push(check('readability', 'content', 'content', 0, 'pass',
                'Not Enough Content to Assess Readability',
                'Readability scoring needs a reasonable amount of text to be meaningful.',
                'Add more content, then re-run the checker for a readability score.'));
        } else {
            var totalSyllables = 0;
            ctx.wordList.forEach(function (w) { totalSyllables += countSyllables(w); });
            var flesch = 206.835 - 1.015 * (wordCount / Math.max(sentenceCount, 1)) - 84.6 * (totalSyllables / Math.max(wordCount, 1));
            flesch = Math.max(0, Math.min(100, Math.round(flesch)));
            var readStatus = flesch >= 60 ? 'pass' : (flesch >= 30 ? 'warn' : 'error');
            var readLabel = flesch >= 60 ? 'easy to read' : (flesch >= 30 ? 'fairly difficult to read' : 'very difficult to read');
            checks.push(check('readability', 'content', 'content', 2, readStatus,
                'Readability Score: ' + flesch + '/100 (' + readLabel + ')',
                'Content that is easier to read keeps visitors engaged longer, which can indirectly support SEO performance.',
                readStatus === 'pass' ? 'No action needed.' : 'Use shorter sentences, simpler words, and more line breaks to improve readability.'));
        }

        // ---------------- IMAGES (category: images) ----------------
        var images = doc.querySelectorAll('img');
        var withAlt = 0, withoutAlt = 0, emptyAlt = 0, withTitle = 0;
        images.forEach(function (img) {
            if (!img.hasAttribute('alt')) { withoutAlt++; }
            else if (img.getAttribute('alt').trim() === '') { emptyAlt++; withAlt++; }
            else { withAlt++; }
            if (img.hasAttribute('title') && img.getAttribute('title').trim()) withTitle++;
        });

        checks.push(check('images-total', 'images', 'images', 1, images.length > 0 ? 'pass' : 'warn',
            images.length + ' Image' + (images.length === 1 ? '' : 's') + ' Found',
            'Relevant images support user engagement and can rank in Google Image Search.',
            images.length > 0 ? 'No action needed.' : 'Consider adding relevant images to support the content, if appropriate for this page.'));

        if (images.length === 0) {
            checks.push(check('images-without-alt', 'images', 'images', 4, 'na',
                'No Images to Check for ALT Text',
                'Not applicable — this page has no images.',
                'No action needed.'));
        } else if (withoutAlt === 0) {
            checks.push(check('images-without-alt', 'images', 'images', 4, 'pass',
                'All Images Have ALT Attributes',
                'ALT text describes images to search engines and screen readers, and is important for accessibility and image SEO.',
                'No action needed.'));
        } else {
            var missingRatio = withoutAlt / images.length;
            checks.push(check('images-without-alt', 'images', 'images', 4, missingRatio > 0.3 ? 'error' : 'warn',
                withoutAlt + ' of ' + images.length + ' Images Missing ALT Attributes',
                'Images without ALT text are invisible to search engines and inaccessible to screen-reader users.',
                'Add descriptive, concise ALT text to every meaningful image (leave alt="" only for purely decorative images).'));
        }

        if (images.length > 0) {
            checks.push(check('empty-alt', 'images', 'images', 1, emptyAlt > 0 ? 'warn' : 'pass',
                emptyAlt + ' Image' + (emptyAlt === 1 ? '' : 's') + ' With Empty ALT Attributes',
                'Empty ALT attributes (alt="") are fine for purely decorative images, but can be a missed opportunity if the image is actually meaningful content.',
                emptyAlt > 0 ? 'Review each empty ALT attribute and add descriptive text if the image conveys meaningful information.' : 'No action needed.'));

            checks.push(check('image-titles', 'images', 'images', 0, 'pass',
                withTitle + ' Image' + (withTitle === 1 ? '' : 's') + ' With a Title Attribute',
                'Title attributes are optional and have minimal direct SEO impact, but can add a small usability hint on hover.',
                'Informational only — not required for good SEO.'));
        }

        // ---------------- LINKS (category: links) ----------------
        var anchors = doc.querySelectorAll('a[href]');
        var internalLinks = [], externalLinks = [], noAnchorText = 0;
        var refHost = ctx.baseUrl ? ctx.baseUrl.hostname.replace(/^www\./, '') : null;

        anchors.forEach(function (a) {
            var href = a.getAttribute('href') || '';
            var text = (a.textContent || '').trim();
            var hasAccessibleText = text.length > 0 || (a.getAttribute('aria-label') || '').trim().length > 0 || (a.getAttribute('title') || '').trim().length > 0;
            if (!hasAccessibleText && !/^(#|javascript:|mailto:$|tel:$)/i.test(href)) noAnchorText++;

            var isExternal = false;
            if (/^(https?:)?\/\//i.test(href)) {
                try {
                    var absHref = href.indexOf('//') === 0 ? 'https:' + href : href;
                    var h = new URL(absHref).hostname.replace(/^www\./, '');
                    isExternal = refHost ? (h !== refHost) : true;
                } catch (e) { isExternal = true; }
            } else if (/^(mailto:|tel:|javascript:|#)/i.test(href)) {
                return; // not counted as internal or external
            }

            if (isExternal) externalLinks.push(href);
            else internalLinks.push(href);
        });

        checks.push(check('links-total', 'links', 'links', 0, 'pass',
            anchors.length + ' Total Links Found',
            'Total count of hyperlinks detected on the page.',
            'Informational only.'));

        checks.push(check('internal-links', 'links', 'links', 1, internalLinks.length > 0 ? 'pass' : 'warn',
            internalLinks.length + ' Internal Link' + (internalLinks.length === 1 ? '' : 's') + ' Found',
            'Internal links help search engines discover and understand the relationships between pages on your site.',
            internalLinks.length > 0 ? 'No action needed.' : 'Add links to other relevant pages on your own site to improve crawlability and distribute page authority.'));

        checks.push(check('external-links', 'links', 'links', 0, 'pass',
            externalLinks.length + ' External Link' + (externalLinks.length === 1 ? '' : 's') + ' Found',
            'External links to reputable sources can add credibility and context for readers.',
            'Informational only — use rel="noopener" (and "nofollow"/"sponsored" where appropriate) on external links.'));

        checks.push(check('anchor-text', 'links', 'links', 3, noAnchorText === 0 ? 'pass' : (noAnchorText > 3 ? 'error' : 'warn'),
            noAnchorText === 0 ? 'All Links Have Descriptive Text' : noAnchorText + ' Link' + (noAnchorText === 1 ? '' : 's') + ' Missing Anchor Text',
            'Descriptive anchor text helps both users and search engines understand where a link leads, and contributes to the linked page’s relevance.',
            noAnchorText === 0 ? 'No action needed.' : 'Add descriptive link text or an aria-label to every link (avoid generic text like "click here" or empty links).'));

        // Broken-link detection: only technically feasible for same-origin links when a live page was fetched.
        checks.push({
            id: 'broken-links', group: 'links', category: 'links', weight: 2,
            status: 'pending', title: '', why: '', fix: '', detail: null,
            _internalLinks: internalLinks, _baseUrl: ctx.baseUrl, _isUrlMode: ctx.isUrlMode
        });

        // ---------------- TECHNICAL SEO (category: technical) ----------------
        if (ctx.isUrlMode) {
            var isHttps = ctx.sourceUrl.protocol === 'https:';
            checks.push(check('https', 'technical', 'technical', 3, isHttps ? 'pass' : 'error',
                isHttps ? 'Site Uses HTTPS' : 'Site Does Not Use HTTPS',
                'HTTPS is a confirmed Google ranking signal and is required for user trust, secure forms, and modern browser features.',
                isHttps ? 'No action needed.' : 'Install an SSL certificate and redirect all HTTP traffic to HTTPS.'));
        } else {
            checks.push(check('https', 'technical', 'technical', 0, 'na',
                'HTTPS Check Not Applicable',
                'Not checked because HTML was pasted directly rather than fetched from a live URL.',
                'Use the "Analyze Website URL" tab to check HTTPS on a live page.'));
        }

        checks.push(check('canonical-technical', 'technical', 'technical', 1, canonicalHref ? 'pass' : 'warn',
            canonicalHref ? 'Canonical Tag Present' : 'Canonical Tag Missing',
            'See the Meta SEO section above for details on why canonical tags matter.',
            canonicalHref ? 'No action needed.' : 'Add a canonical tag to avoid duplicate-content issues.'));

        var htmlEl = doc.documentElement;
        var langAttr = htmlEl ? htmlEl.getAttribute('lang') : null;
        checks.push(check('lang-attr', 'technical', 'technical', 2, langAttr ? 'pass' : 'warn',
            langAttr ? 'Language Attribute Set (' + langAttr + ')' : 'Missing HTML Language Attribute',
            'The lang attribute tells search engines and browsers (including screen readers and translation tools) what language the page is written in.',
            langAttr ? 'No action needed.' : 'Add a lang attribute to the <html> tag, e.g. <html lang="en">.'));

        checks.push(check('viewport-technical', 'technical', 'technical', 2, viewportEl ? 'pass' : 'error',
            viewportEl ? 'Mobile Viewport Configured' : 'Mobile Viewport Missing',
            'Google primarily uses mobile-first indexing, so a correctly configured viewport is essential for rankings.',
            viewportEl ? 'No action needed.' : 'Add a responsive viewport meta tag to the <head>.'));

        var hasDoctype = /^\s*<!doctype html>/i.test(ctx.rawHtml || '');
        var hasMain = !!doc.querySelector('main, [role="main"]');
        var hasHeader = !!doc.querySelector('header');
        var structureScore = (hasDoctype ? 1 : 0) + (hasMain ? 1 : 0) + (hasHeader ? 1 : 0);
        checks.push(check('page-structure', 'technical', 'technical', 2, structureScore === 3 ? 'pass' : (structureScore >= 1 ? 'warn' : 'error'),
            structureScore === 3 ? 'Good Semantic Page Structure' : 'Page Structure Could Be Improved',
            'A proper HTML5 doctype and semantic landmarks (header, main) help browsers, search engines and assistive technology understand page layout.',
            structureScore === 3 ? 'No action needed.' : 'Ensure the page starts with <!DOCTYPE html> and uses semantic tags like <header> and <main>.',
            'Doctype: ' + (hasDoctype ? 'yes' : 'no') + ' · <main>: ' + (hasMain ? 'yes' : 'no') + ' · <header>: ' + (hasHeader ? 'yes' : 'no')));

        if (ctx.isUrlMode) {
            checks.push({ id: 'robots-txt', group: 'technical', category: 'technical', weight: 2, status: 'pending', title: '', why: '', fix: '', detail: null, _baseUrl: ctx.sourceUrl });
            checks.push({ id: 'sitemap-xml', group: 'technical', category: 'technical', weight: 2, status: 'pending', title: '', why: '', fix: '', detail: null, _baseUrl: ctx.sourceUrl });
        } else {
            checks.push(check('robots-txt', 'technical', 'technical', 0, 'na',
                'robots.txt Not Checked',
                'Not checked because HTML was pasted directly rather than fetched from a live URL.',
                'Use the "Analyze Website URL" tab, or manually visit yoursite.com/robots.txt.'));
            checks.push(check('sitemap-xml', 'technical', 'technical', 0, 'na',
                'sitemap.xml Not Checked',
                'Not checked because HTML was pasted directly rather than fetched from a live URL.',
                'Use the "Analyze Website URL" tab, or manually visit yoursite.com/sitemap.xml.'));
        }

        // ---------------- STRUCTURED DATA (schema + social) ----------------
        var ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
        var schemaTypes = [];
        var invalidJsonLd = 0;
        ldScripts.forEach(function (s) {
            try {
                var data = JSON.parse(s.textContent);
                collectSchemaTypes(data, schemaTypes);
            } catch (e) { invalidJsonLd++; }
        });
        var microdataCount = doc.querySelectorAll('[itemscope]').length;

        if (ldScripts.length === 0 && microdataCount === 0) {
            checks.push(check('json-ld', 'structured', 'schema', 3, 'error',
                'No Structured Data (JSON-LD) Found',
                'Structured data helps search engines understand your content and can enable rich results (stars, FAQs, breadcrumbs) in Google.',
                'Add relevant JSON-LD schema, such as Organization, WebPage, BreadcrumbList, or FAQPage where applicable.'));
        } else if (invalidJsonLd > 0) {
            checks.push(check('json-ld', 'structured', 'schema', 3, 'warn',
                invalidJsonLd + ' JSON-LD Block' + (invalidJsonLd === 1 ? '' : 's') + ' Has Invalid Syntax',
                'Invalid JSON-LD cannot be parsed by search engines and will be ignored, wasting the potential rich-result benefit.',
                'Validate your JSON-LD with a JSON linter and fix any syntax errors (missing commas, quotes, or brackets).'));
        } else {
            checks.push(check('json-ld', 'structured', 'schema', 3, 'pass',
                ldScripts.length + ' Valid JSON-LD Block' + (ldScripts.length === 1 ? '' : 's') + ' Found',
                'Structured data helps search engines understand your content and can enable rich results.',
                'No action needed.'));
        }

        checks.push(check('schema-types', 'structured', 'schema', 2, schemaTypes.length > 0 ? 'pass' : (microdataCount > 0 ? 'warn' : 'na'),
            schemaTypes.length > 0 ? 'Schema Types Detected' : (microdataCount > 0 ? 'Microdata Found (No JSON-LD Types)' : 'No Schema Types Detected'),
            'Specific schema types (e.g. Organization, Product, Article, FAQPage) tell Google exactly what kind of content is on the page.',
            schemaTypes.length > 0 ? 'No action needed.' : 'Add JSON-LD with a specific @type relevant to this page’s content.',
            schemaTypes.length > 0 ? Array.from(new Set(schemaTypes)).join(', ') : (microdataCount > 0 ? microdataCount + ' microdata itemscope element(s) found' : null)));

        var ogTitle = doc.querySelector('meta[property="og:title"]');
        var ogDesc = doc.querySelector('meta[property="og:description"]');
        var ogImage = doc.querySelector('meta[property="og:image"]');
        var ogType = doc.querySelector('meta[property="og:type"]');
        var ogCount = [ogTitle, ogDesc, ogImage, ogType].filter(Boolean).length;
        checks.push(check('open-graph', 'structured', 'social', 3, ogCount === 4 ? 'pass' : (ogCount > 0 ? 'warn' : 'error'),
            ogCount === 4 ? 'Open Graph Tags Complete' : (ogCount > 0 ? 'Open Graph Tags Incomplete (' + ogCount + '/4)' : 'Open Graph Tags Missing'),
            'Open Graph tags control how your page appears when shared on Facebook, LinkedIn, WhatsApp and other platforms.',
            ogCount === 4 ? 'No action needed.' : 'Add og:title, og:description, og:image and og:type meta tags to the <head>.',
            [ogTitle && 'og:title', ogDesc && 'og:description', ogImage && 'og:image', ogType && 'og:type'].filter(Boolean).join(', ') || null));

        var twitterCard = doc.querySelector('meta[name="twitter:card"]');
        var twitterTitle = doc.querySelector('meta[name="twitter:title"]');
        var twCount = [twitterCard, twitterTitle].filter(Boolean).length;
        checks.push(check('twitter-cards', 'structured', 'social', 2, twCount === 2 ? 'pass' : (twCount > 0 ? 'warn' : 'error'),
            twCount === 2 ? 'Twitter Card Tags Present' : (twCount > 0 ? 'Twitter Card Tags Incomplete' : 'Twitter Card Tags Missing'),
            'Twitter Card tags control how your page appears when shared on X (Twitter).',
            twCount === 2 ? 'No action needed.' : 'Add twitter:card and twitter:title meta tags (twitter:description and twitter:image are also recommended).'));

        return {
            checks: checks,
            titleText: titleText,
            metaDescText: metaDescText,
            canonicalHref: canonicalHref,
            h1Text: h1s.length ? h1s[0].textContent.trim() : ''
        };
    }

    function collectSchemaTypes(data, out) {
        if (!data || typeof data !== 'object') return;
        if (Array.isArray(data)) { data.forEach(function (d) { collectSchemaTypes(d, out); }); return; }
        if (data['@type']) {
            if (Array.isArray(data['@type'])) out.push.apply(out, data['@type']);
            else out.push(data['@type']);
        }
        if (data['@graph']) collectSchemaTypes(data['@graph'], out);
    }

    // -----------------------------------------------------------------
    // Async follow-up checks: robots.txt, sitemap.xml, broken links
    // (resolved after initial render, then patched in)
    // -----------------------------------------------------------------
    function resolvePendingChecks(analysis, ctx) {
        analysis.checks.forEach(function (c) {
            if (c.status !== 'pending') return;

            if (c.id === 'robots-txt' || c.id === 'sitemap-xml') {
                var path = c.id === 'robots-txt' ? '/robots.txt' : '/sitemap.xml';
                var target = c._baseUrl.origin + path;
                fetchWithTimeout(target, 6000)
                    .then(function (res) {
                        Object.assign(c, res.ok
                            ? check(c.id, c.group, c.category, c.weight, 'pass',
                                path.substring(1) + ' Found',
                                path === '/robots.txt' ? 'robots.txt tells search engine crawlers which parts of your site they may access.' : 'A sitemap.xml helps search engines discover and crawl all important pages on your site.',
                                'No action needed.', target)
                            : check(c.id, c.group, c.category, c.weight, 'warn',
                                path.substring(1) + ' Not Found (HTTP ' + res.status + ')',
                                path === '/robots.txt' ? 'Without robots.txt, crawlers use default behavior, which is usually fine but offers no explicit crawl guidance.' : 'Without a sitemap, search engines must rely purely on link discovery to find all your pages.',
                                'Create a ' + path.substring(1) + ' file at your site root.', target));
                        patchCheckInDom(c);
                    })
                    .catch(function () {
                        Object.assign(c, check(c.id, c.group, c.category, 0, 'na',
                            path.substring(1) + ' Could Not Be Verified',
                            'This resource could not be checked directly from the browser, likely due to CORS restrictions.',
                            'Manually visit ' + target + ' in your browser to confirm it exists.'));
                        patchCheckInDom(c);
                    });
            }

            if (c.id === 'broken-links') {
                if (!c._isUrlMode || !c._internalLinks.length) {
                    Object.assign(c, check('broken-links', 'links', 'links', 0, 'na',
                        c._isUrlMode ? 'No Internal Links to Verify' : 'Broken-Link Check Not Applicable',
                        c._isUrlMode ? 'This page has no internal links to sample-test.' : 'Live link status can only be checked when analyzing a fetched URL, not pasted HTML.',
                        'No action needed.'));
                    patchCheckInDom(c);
                    return;
                }
                var sample = c._internalLinks.slice(0, 5).map(function (href) {
                    try { return new URL(href, c._baseUrl.href).href; } catch (e) { return null; }
                }).filter(Boolean);

                Promise.all(sample.map(function (link) {
                    return fetchWithTimeout(link, 6000).then(function (res) {
                        return { link: link, ok: res.ok, status: res.status, verified: true };
                    }).catch(function () {
                        return { link: link, ok: null, verified: false };
                    });
                })).then(function (outcomes) {
                    var broken = outcomes.filter(function (o) { return o.verified && !o.ok; });
                    var unverified = outcomes.filter(function (o) { return !o.verified; });
                    var status = broken.length > 0 ? 'error' : (unverified.length === outcomes.length ? 'na' : 'pass');
                    var detail = outcomes.map(function (o) {
                        return o.verified ? (o.link + ' — HTTP ' + o.status) : (o.link + ' — not verified (cross-origin)');
                    }).join('\n');
                    Object.assign(c, check('broken-links', 'links', 'links', status === 'na' ? 0 : 2, status,
                        broken.length > 0 ? broken.length + ' Broken Internal Link' + (broken.length === 1 ? '' : 's') + ' Found'
                            : (status === 'na' ? 'Internal Links Could Not Be Verified' : 'Sampled Internal Links Are Working'),
                        'Broken links waste crawl budget and create a poor user experience, and can slightly hurt SEO if widespread.',
                        broken.length > 0 ? 'Fix or remove the broken links listed below.' : (status === 'na' ? 'These links point to a different origin and cannot be checked from this browser due to CORS restrictions.' : 'No action needed.'),
                        detail + (c._internalLinks.length > 5 ? '\n(sampled ' + sample.length + ' of ' + c._internalLinks.length + ' internal links)' : '')));
                    patchCheckInDom(c);
                });
            }
        });
    }

    function fetchWithTimeout(url, ms) {
        var controller = ('AbortController' in window) ? new AbortController() : null;
        var timer = controller ? setTimeout(function () { controller.abort(); }, ms) : null;
        return fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller ? controller.signal : undefined })
            .then(function (res) { if (timer) clearTimeout(timer); return res; })
            .catch(function (err) { if (timer) clearTimeout(timer); throw err; });
    }

    function patchCheckInDom(c) {
        var el = checksGroups.querySelector('[data-check-id="' + cssEscape(c.id) + '"]');
        if (!el) return;
        var refreshed = renderCheckItem(c);
        el.replaceWith(refreshed);
        recomputeSummary();
    }

    function cssEscape(s) {
        return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    }

    // -----------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------
    var lastAnalysis = null;

    function renderResults(analysis, ctx, keyword) {
        lastAnalysis = analysis;

        renderOverview(analysis);
        renderSerp(analysis, ctx);
        renderKeyword(analysis, ctx, keyword);
        renderChecksGroups(analysis);

        resolvePendingChecks(analysis, ctx);
    }

    function statusValue(status) {
        if (status === 'pass') return 1;
        if (status === 'warn') return 0.5;
        return 0; // error
    }

    function computeScores(checksList) {
        var categories = {};
        Object.keys(CATEGORY_WEIGHTS).forEach(function (k) { categories[k] = { earned: 0, possible: 0 }; });

        var passed = 0, warnings = 0, errors = 0;
        checksList.forEach(function (c) {
            if (c.status === 'pass') passed++;
            else if (c.status === 'warn') warnings++;
            else if (c.status === 'error') errors++;

            if (c.status === 'na' || c.status === 'pending' || !c.weight) return;
            categories[c.category].earned += c.weight * statusValue(c.status);
            categories[c.category].possible += c.weight;
        });

        var categoryScores = {};
        Object.keys(categories).forEach(function (k) {
            var cat = categories[k];
            categoryScores[k] = cat.possible > 0 ? Math.round((cat.earned / cat.possible) * 100) : null;
        });

        var overallEarned = 0, overallPossible = 0;
        Object.keys(CATEGORY_WEIGHTS).forEach(function (k) {
            if (categoryScores[k] === null) return;
            overallEarned += categoryScores[k] * CATEGORY_WEIGHTS[k];
            overallPossible += CATEGORY_WEIGHTS[k];
        });
        var overall = overallPossible > 0 ? Math.round(overallEarned / overallPossible) : 0;

        return { overall: overall, categoryScores: categoryScores, passed: passed, warnings: warnings, errors: errors };
    }

    function recomputeSummary() {
        if (!lastAnalysis) return;
        var scores = computeScores(lastAnalysis.checks);
        applyOverviewScores(scores);
    }

    function tierFor(score) {
        if (score >= 80) return 'good';
        if (score >= 50) return 'warn';
        return 'bad';
    }

    function applyOverviewScores(scores) {
        var offset = CIRCUMFERENCE - (scores.overall / 100) * CIRCUMFERENCE;
        scoreArc.style.strokeDashoffset = String(offset);
        scoreArc.classList.remove('tier-good', 'tier-warn', 'tier-bad');
        scoreArc.classList.add('tier-' + tierFor(scores.overall));
        scoreNumber.textContent = String(scores.overall);

        var verdict = scores.overall >= 90 ? 'Excellent — your SEO fundamentals are strong.'
            : scores.overall >= 75 ? 'Good — a few improvements will help.'
            : scores.overall >= 50 ? 'Needs Improvement — several issues are holding you back.'
            : 'Poor — significant SEO issues need attention.';
        scoreVerdictBadge.textContent = 'SEO Score: ' + scores.overall + '/100';
        scoreVerdictText.textContent = verdict;

        countPassed.textContent = String(scores.passed);
        countWarnings.textContent = String(scores.warnings);
        countErrors.textContent = String(scores.errors);

        var total = Math.max(scores.passed + scores.warnings + scores.errors, 1);
        segPass.style.width = (scores.passed / total * 100) + '%';
        segWarn.style.width = (scores.warnings / total * 100) + '%';
        segError.style.width = (scores.errors / total * 100) + '%';

        renderCategoryGrid(scores.categoryScores);
    }

    function renderOverview(analysis) {
        var scores = computeScores(analysis.checks);
        applyOverviewScores(scores);
    }

    function renderCategoryGrid(categoryScores) {
        categoryGrid.textContent = '';
        Object.keys(CATEGORY_META).forEach(function (key) {
            var meta = CATEGORY_META[key];
            var score = categoryScores[key];

            var item = document.createElement('div');
            item.className = 'seo-category-item' + (score === null ? ' na' : (' tier-' + tierFor(score)));

            var head = document.createElement('div');
            head.className = 'seo-category-item-head';
            head.innerHTML = '<svg class="icon"><use href="#' + meta.icon + '"/></svg>';
            var label = document.createElement('span');
            label.textContent = meta.label;
            head.appendChild(label);
            item.appendChild(head);

            var row = document.createElement('div');
            row.className = 'seo-category-score-row';
            var num = document.createElement('span');
            num.className = 'seo-category-score-num';
            num.textContent = score === null ? 'N/A' : String(score);
            var max = document.createElement('span');
            max.className = 'seo-category-score-max';
            max.textContent = score === null ? '' : '/ 100';
            row.appendChild(num);
            row.appendChild(max);
            item.appendChild(row);

            var bar = document.createElement('div');
            bar.className = 'seo-mini-bar';
            var fill = document.createElement('span');
            fill.style.width = (score === null ? 0 : score) + '%';
            bar.appendChild(fill);
            item.appendChild(bar);

            categoryGrid.appendChild(item);
        });
    }

    function truncate(str, max) {
        if (!str) return '';
        return str.length > max ? str.substring(0, max - 1).trim() + '…' : str;
    }

    function renderSerp(analysis, ctx) {
        var displayUrl = ctx.baseUrl ? ctx.baseUrl.href : (analysis.canonicalHref || 'https://example.com');
        var host = 'example.com';
        try { host = new URL(displayUrl).hostname; } catch (e) { /* keep default */ }

        serpSiteName.textContent = host;
        serpUrl.textContent = displayUrl;
        serpTitle.textContent = truncate(analysis.titleText || '(No title tag found)', 65);
        serpDescription.textContent = truncate(analysis.metaDescText || 'No meta description found for this page. Google may auto-generate a snippet from page content instead.', 165);
    }

    function renderKeyword(analysis, ctx, keyword) {
        if (!keyword) {
            keywordCard.hidden = true;
            keywordChecks.textContent = '';
            return;
        }
        keywordCard.hidden = false;
        keywordEcho.textContent = keyword;
        keywordChecks.textContent = '';

        var kw = keyword.toLowerCase();
        var kwWords = kw.match(/[a-z0-9']+/g) || [];
        var bodyLower = ctx.bodyText.toLowerCase();

        var inTitle = analysis.titleText.toLowerCase().indexOf(kw) !== -1;
        var inDesc = analysis.metaDescText.toLowerCase().indexOf(kw) !== -1;
        var inH1 = analysis.h1Text.toLowerCase().indexOf(kw) !== -1;
        var headingsText = Array.from(ctx.doc.querySelectorAll('h1,h2,h3')).map(function (h) { return h.textContent.toLowerCase(); }).join(' ');
        var inHeadings = headingsText.indexOf(kw) !== -1;
        var inFirstPara = ctx.firstParagraphText.toLowerCase().indexOf(kw) !== -1;

        var occurrences = kw ? (bodyLower.split(kw).length - 1) : 0;
        var density = ctx.wordList.length > 0 ? (occurrences * kwWords.length / ctx.wordList.length) * 100 : 0;

        var items = [
            { ok: inTitle, label: 'Keyword in Title', why: 'Including your target keyword in the title is one of the strongest on-page relevance signals.', fixYes: 'No action needed.', fixNo: 'Consider naturally including "' + keyword + '" in your page title.' },
            { ok: inDesc, label: 'Keyword in Meta Description', why: 'A keyword in the meta description reinforces relevance and can be bolded in search results, improving click-through.', fixYes: 'No action needed.', fixNo: 'Naturally include "' + keyword + '" in your meta description.' },
            { ok: inH1, label: 'Keyword in H1', why: 'Your H1 should reflect the main topic of the page, ideally matching or closely relating to the target keyword.', fixYes: 'No action needed.', fixNo: 'Consider including "' + keyword + '" in your H1 heading.' },
            { ok: inHeadings, label: 'Keyword in Headings', why: 'Using the keyword or close variants across subheadings reinforces topical relevance throughout the page.', fixYes: 'No action needed.', fixNo: 'Work "' + keyword + '" or a natural variant into at least one H2/H3 heading.' },
            { ok: inFirstPara, label: 'Keyword in First Paragraph', why: 'Mentioning the target keyword early in the content helps confirm topical relevance to both users and search engines.', fixYes: 'No action needed.', fixNo: 'Mention "' + keyword + '" naturally within the first paragraph of content.' }
        ];

        items.forEach(function (it) {
            keywordChecks.appendChild(renderCheckItem(check(
                'kw-' + it.label, 'keyword', 'keyword', 0, it.ok ? 'pass' : 'warn',
                it.label + (it.ok ? ' ✓' : ''), it.why, it.ok ? it.fixYes : it.fixNo
            )));
        });

        var densityStatus = density === 0 ? 'error' : (density > 3 ? 'warn' : 'pass');
        keywordChecks.appendChild(renderCheckItem(check(
            'kw-freq', 'keyword', 'keyword', 0, densityStatus,
            'Keyword Frequency & Density: ' + occurrences + ' occurrence' + (occurrences === 1 ? '' : 's') + ' (' + density.toFixed(1) + '% density)',
            'Keyword density shows how often your target keyword appears relative to total word count. There is no single "ideal" number — natural, contextual usage matters far more than hitting a specific percentage.',
            density === 0 ? 'Your keyword doesn’t appear in the content at all — consider adding it naturally.' : (density > 3 ? 'Density is on the high side — avoid repeating the exact phrase excessively and use natural variations instead. Never keyword-stuff.' : 'Density looks natural. Do not force additional repetitions.')
        )));
    }

    function renderCheckItem(c) {
        var wrap = document.createElement('div');
        var status = c.status === 'na' ? 'info' : (c.status === 'pending' ? 'info' : c.status);
        wrap.className = 'seo-check-item status-' + status;
        wrap.setAttribute('data-check-id', c.id);

        var iconWrap = document.createElement('div');
        iconWrap.className = 'seo-check-icon';
        var iconName = c.status === 'pass' ? 'icon-check' : (c.status === 'warn' ? 'icon-alert-triangle' : (c.status === 'error' ? 'icon-x' : 'icon-sliders'));
        iconWrap.innerHTML = '<svg class="icon"><use href="#' + iconName + '"/></svg>';
        wrap.appendChild(iconWrap);

        var body = document.createElement('div');
        body.className = 'seo-check-body';

        var title = document.createElement('div');
        title.className = 'seo-check-title';
        var emoji = c.status === 'pass' ? '🟢 ' : c.status === 'warn' ? '🟠 ' : c.status === 'error' ? '🔴 ' : '';
        title.textContent = (c.status === 'pending' ? '⏳ Checking…' : emoji + c.title);
        body.appendChild(title);

        if (c.status !== 'pending') {
            var why = document.createElement('div');
            why.className = 'seo-check-why';
            why.textContent = c.why;
            body.appendChild(why);

            if (c.fix) {
                var fix = document.createElement('div');
                fix.className = 'seo-check-fix';
                var b = document.createElement('b');
                b.textContent = 'Recommendation: ';
                fix.appendChild(b);
                fix.appendChild(document.createTextNode(c.fix));
                body.appendChild(fix);
            }

            if (c.detail) {
                var detail = document.createElement('div');
                detail.className = 'seo-check-detail';
                detail.textContent = c.detail;
                body.appendChild(detail);
            }
        }

        wrap.appendChild(body);
        return wrap;
    }

    function renderChecksGroups(analysis) {
        checksGroups.textContent = '';
        GROUP_ORDER.forEach(function (groupKey) {
            var groupChecks = analysis.checks.filter(function (c) { return c.group === groupKey; });
            if (!groupChecks.length) return;

            var meta = GROUP_META[groupKey];
            var section = document.createElement('div');
            section.className = 'card seo-check-group';

            var head = document.createElement('div');
            head.className = 'seo-check-group-head';
            var iconCircle = document.createElement('div');
            iconCircle.className = 'icon-circle';
            iconCircle.innerHTML = '<svg class="icon"><use href="#' + meta.icon + '"/></svg>';
            head.appendChild(iconCircle);
            var h3 = document.createElement('h3');
            h3.textContent = meta.label;
            head.appendChild(h3);
            section.appendChild(head);

            var list = document.createElement('div');
            list.className = 'seo-check-list';
            groupChecks.forEach(function (c) { list.appendChild(renderCheckItem(c)); });
            section.appendChild(list);

            checksGroups.appendChild(section);
        });
    }

})();
