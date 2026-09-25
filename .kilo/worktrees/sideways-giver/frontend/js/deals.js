/**
 * deals.js — the feed page.
 *
 * Sections: config → API client → formatting → rendering → feed states →
 *           filters → post form → boot.
 *
 * Decisions worth defending:
 *  - Filtering is SERVER-side (?type=) because the brief asks the API to support it,
 *    and it keeps the client honest if the list ever grows or gets paginated.
 *  - No pagination: the API returns the newest 50. Cursor pagination is the next step.
 *  - User text is only ever written with textContent, never innerHTML (XSS-safe).
 *  - Client validation mirrors the server's rules for fast feedback; the SERVER is the
 *    authority, and its 422 field errors are rendered in the same place.
 *  - A response counter drops stale replies when someone clicks pills quickly.
 */
(function () {
  'use strict';

  /* ------------------------------ config ------------------------------ */

  // CHANGE THIS to your Railway URL before deploying (no trailing slash).
  var API_BASE = 'http://localhost:8000';
  var REQUEST_TIMEOUT_MS = 20000; // free hosting can take ~30s to wake, so be generous

  // Keep in sync with the backend validation and the README.
  var LIMITS = { textMax: 60, pitchMax: 140, amountMin: 10000, amountMax: 1000000000 };
  var SECTORS = ['Fintech', 'HealthTech', 'AgriTech', 'EdTech', 'SaaS', 'D2C', 'Clean Energy', 'Logistics', 'Other'];
  var FUNDING_TYPES = ['Equity', 'Loan', 'Grant'];

  var state = { filter: 'All', deals: [], loadId: 0, highlightId: null };

  /* ---------------------------- API client ---------------------------- */

  function ApiError(status, body, kind) {
    this.status = status;   // 0 = never reached the server
    this.body = body;
    this.kind = kind || 'http';
  }
  ApiError.prototype = Object.create(Error.prototype);

  function request(path, options) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
    options = options || {};
    options.signal = controller.signal;

    return fetch(API_BASE + path, options)
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (body) {
          if (!res.ok) throw new ApiError(res.status, body);
          return body;
        });
      })
      .catch(function (err) {
        if (err instanceof ApiError) throw err;
        // Open DevTools (F12) > Console: a CORS problem and a stopped server both land here.
        console.error('[askboard] Request to ' + API_BASE + path + ' failed before any response.', err);
        throw new ApiError(0, null, err && err.name === 'AbortError' ? 'timeout' : 'network');
      })
      .finally(function () { clearTimeout(timer); });
  }

  function fetchDeals(type) {
    var qs = type && type !== 'All' ? '?type=' + encodeURIComponent(type) : '';
    return request('/api/deals/list.php' + qs).then(function (body) { return body.data || []; });
  }

  function createDeal(payload) {
    return request('/api/deals/create.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (body) { return body.data; });
  }

  /* ---------------------------- formatting ---------------------------- */

  var inr = new Intl.NumberFormat('en-IN');
  var rtf = typeof Intl.RelativeTimeFormat === 'function' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;

  function formatRs(n) { return 'Rs ' + inr.format(n); }

  function formatPercent(n) { return Number(n) + '%'; } // 8.50 -> "8.5%"

  function timeAgo(iso) {
    var t = new Date(iso).getTime();
    if (isNaN(t) || !rtf) return '';
    var s = Math.round((t - Date.now()) / 1000);
    var abs = Math.abs(s);
    if (abs < 60) return 'just now';
    if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
    return rtf.format(Math.round(s / 86400), 'day');
  }

  /* ----------------------------- rendering ---------------------------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function askItem(label, value) {
    var wrap = el('div', 'ask-item');
    wrap.appendChild(el('span', 'ask-k', label));
    wrap.appendChild(el('span', 'ask-v', value));
    return wrap;
  }

  function buildCard(deal) {
    var type = deal.funding_type;
    var card = el('article', 'deal-card glass ft-' + String(type).toLowerCase());
    if (deal.id === state.highlightId) card.classList.add('is-new');

    var head = el('header', 'deal-head');
    head.appendChild(el('span', 'co-mark', String(deal.company_name).charAt(0).toUpperCase()));
    var who = el('div', 'deal-who');
    who.appendChild(el('h3', 'co-name', deal.company_name));
    who.appendChild(el('p', 'co-founder', 'by ' + deal.founder_name));
    head.appendChild(who);
    head.appendChild(el('span', 'ft-pill', type));
    card.appendChild(head);

    card.appendChild(el('p', 'deal-pitch', deal.pitch));

    var ask = el('div', 'ask-row');
    ask.appendChild(askItem('Amount sought', formatRs(deal.amount_inr)));
    if (type === 'Equity' && deal.equity_percent != null) {
      ask.appendChild(askItem('Equity offered', formatPercent(deal.equity_percent)));
    }
    card.appendChild(ask);

    var foot = el('footer', 'deal-foot');
    foot.appendChild(el('span', 'dtag', deal.sector));
    foot.appendChild(el('time', 'deal-time', timeAgo(deal.created_at)));
    card.appendChild(foot);

    return card;
  }

  /* --------------------------- feed + states -------------------------- */

  var feedEl = document.getElementById('feed');
  var messageEl = document.getElementById('feed-message');
  var statusEl = document.getElementById('feed-status');

  function setBusy(busy) { feedEl.setAttribute('aria-busy', String(busy)); }

  function hideMessage() { messageEl.hidden = true; messageEl.textContent = ''; }

  function showMessage(title, text, actionLabel, onAction) {
    messageEl.textContent = '';
    messageEl.appendChild(el('h2', 'msg-title', title));
    messageEl.appendChild(el('p', 'msg-text', text));
    if (actionLabel) {
      var btn = el('button', 'btn-primary btn-inline', actionLabel);
      btn.type = 'button';
      btn.addEventListener('click', onAction);
      messageEl.appendChild(btn);
    }
    messageEl.hidden = false;
  }

  function renderLoading() {
    hideMessage();
    setBusy(true);
    feedEl.textContent = '';
    for (var i = 0; i < 4; i++) feedEl.appendChild(el('div', 'skel-card glass'));
    statusEl.textContent = 'Loading asks…';
  }

  function renderDeals() {
    setBusy(false);
    feedEl.textContent = '';
    hideMessage();

    if (!state.deals.length) {
      var label = state.filter === 'All' ? '' : state.filter.toLowerCase() + ' ';
      showMessage(
        'No ' + label + 'asks yet',
        state.filter === 'All' ? 'Be the first founder to post one.' : 'Nobody has posted a ' + state.filter.toLowerCase() + ' ask yet. Post one, or check All.',
        'Post an Ask',
        openPostDialog
      );
      statusEl.textContent = 'No asks found.';
      return;
    }

    state.deals.forEach(function (d) { feedEl.appendChild(buildCard(d)); });
    statusEl.textContent = 'Showing ' + state.deals.length + (state.deals.length === 1 ? ' ask.' : ' asks.');
  }

  function renderError(err) {
    setBusy(false);
    feedEl.textContent = '';
    var text = err.kind === 'timeout'
      ? 'The server took too long to answer. If it was idle, it may still be waking up. Try again in a few seconds.'
      : err.status === 0
        ? 'We couldn\'t reach the server. Check your connection and try again.'
        : 'The server returned an error (' + err.status + '). Try again in a moment.';
    showMessage('Couldn\'t load asks', text, 'Try again', loadDeals);
    statusEl.textContent = 'Failed to load asks.';
  }

  function loadDeals() {
    var id = ++state.loadId;
    renderLoading();
    fetchDeals(state.filter)
      .then(function (deals) {
        if (id !== state.loadId) return; // a newer request superseded this one
        state.deals = deals;
        renderDeals();
        state.highlightId = null;
      })
      .catch(function (err) {
        if (id !== state.loadId) return;
        renderError(err);
      });
  }

  /* ------------------------------ filters ----------------------------- */

  function setFilter(value) {
    state.filter = value;
    document.querySelectorAll('#filters .pill').forEach(function (p) {
      p.setAttribute('aria-pressed', String(p.getAttribute('data-filter') === value));
    });
  }

  function initFilters() {
    document.getElementById('filters').addEventListener('click', function (e) {
      var pill = e.target.closest('.pill');
      if (!pill || pill.getAttribute('data-filter') === state.filter) return;
      setFilter(pill.getAttribute('data-filter'));
      loadDeals();
    });
  }

  /* ---------------------------- post form ----------------------------- */

  var dialog = document.getElementById('post-dialog');
  var form = document.getElementById('post-form');
  var formErrorEl = document.getElementById('post-error');
  var submitBtn = document.getElementById('submit-post');
  var equityField = document.getElementById('equity-field');
  var amountHelp = document.getElementById('amount-help');
  var pitchCount = document.getElementById('pitch-count');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 3500);
  }

  function fieldEl(name) { return form.elements[name]; }
  function errorEl(name) { return form.querySelector('[data-error-for="' + name + '"]'); }

  function setFieldError(name, message) {
    var err = errorEl(name);
    if (!err) return;
    var input = fieldEl(name);
    var isRadioGroup = input && input.length !== undefined && !input.tagName; // RadioNodeList
    if (message) {
      err.textContent = message;
      err.hidden = false;
      if (!isRadioGroup && input) input.setAttribute('aria-invalid', 'true');
    } else {
      err.hidden = true;
      if (!isRadioGroup && input) input.removeAttribute('aria-invalid');
    }
  }

  function clearFormErrors() {
    Object.keys(fieldMap()).forEach(function (n) { setFieldError(n, ''); });
    formErrorEl.hidden = true;
  }

  function fieldMap() {
    return { company_name: 1, founder_name: 1, sector: 1, pitch: 1, funding_type: 1, amount_inr: 1, equity_percent: 1 };
  }

  function showFieldErrors(errors) {
    var first = null;
    Object.keys(errors).forEach(function (name) {
      setFieldError(name, errors[name]);
      if (!first && fieldEl(name) && fieldEl(name).focus) first = fieldEl(name);
    });
    if (first) first.focus();
  }

  function readForm() {
    var fd = new FormData(form);
    var type = fd.get('funding_type');
    var payload = {
      company_name: String(fd.get('company_name') || '').trim(),
      founder_name: String(fd.get('founder_name') || '').trim(),
      sector: fd.get('sector'),
      pitch: String(fd.get('pitch') || '').trim(),
      funding_type: type,
      amount_inr: parseAmount(fd.get('amount_inr')),
      equity_percent: null
    };
    if (type === 'Equity') payload.equity_percent = parsePercent(fd.get('equity_percent'));
    return payload;
  }

  // Returns an integer, or NaN if the text isn't a whole number of rupees.
  function parseAmount(raw) {
    var s = String(raw || '').replace(/[,\s]/g, '');
    return /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
  }

  function parsePercent(raw) {
    var s = String(raw || '').trim();
    return /^\d+(\.\d{1,2})?$/.test(s) ? parseFloat(s) : NaN;
  }

  function validate(p) {
    var e = {};
    if (!p.company_name) e.company_name = 'Enter your company name.';
    else if (p.company_name.length > LIMITS.textMax) e.company_name = 'Keep it to ' + LIMITS.textMax + ' characters or fewer.';

    if (!p.founder_name) e.founder_name = 'Enter the founder\'s name.';
    else if (p.founder_name.length > LIMITS.textMax) e.founder_name = 'Keep it to ' + LIMITS.textMax + ' characters or fewer.';

    if (SECTORS.indexOf(p.sector) === -1) e.sector = 'Choose a sector.';

    if (!p.pitch) e.pitch = 'Write a one-line pitch.';
    else if (p.pitch.length > LIMITS.pitchMax) e.pitch = 'Keep the pitch to ' + LIMITS.pitchMax + ' characters or fewer.';

    if (FUNDING_TYPES.indexOf(p.funding_type) === -1) e.funding_type = 'Choose a funding type.';

    if (isNaN(p.amount_inr)) e.amount_inr = 'Enter the amount as a whole number of rupees, like 2500000.';
    else if (p.amount_inr < LIMITS.amountMin || p.amount_inr > LIMITS.amountMax) {
      e.amount_inr = 'Amount must be between ' + formatRs(LIMITS.amountMin) + ' and Rs 100 crore.';
    }

    if (p.funding_type === 'Equity') {
      if (p.equity_percent == null || isNaN(p.equity_percent)) e.equity_percent = 'Enter the equity you\'re offering, like 8 or 7.5.';
      else if (p.equity_percent <= 0 || p.equity_percent >= 100) e.equity_percent = 'Equity must be more than 0% and less than 100%.';
    }
    return e;
  }

  function syncEquityField() {
    var isEquity = fieldEl('funding_type').value === 'Equity';
    equityField.hidden = !isEquity;
    if (!isEquity) { fieldEl('equity_percent').value = ''; setFieldError('equity_percent', ''); }
  }

  function syncAmountHelp() {
    var n = parseAmount(fieldEl('amount_inr').value);
    amountHelp.textContent = isNaN(n) ? 'Between ' + formatRs(LIMITS.amountMin) + ' and Rs 100 crore.' : formatRs(n);
  }

  function openPostDialog() {
    form.reset();
    clearFormErrors();
    syncEquityField();
    syncAmountHelp();
    pitchCount.textContent = '0/' + LIMITS.pitchMax;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    fieldEl('company_name').focus();
  }

  function closePostDialog() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function onCreated(deal) {
    state.highlightId = deal.id;
    var matches = state.filter === 'All' || state.filter === deal.funding_type;
    if (matches) {
      // Show it instantly from the server's response: no reload, no refetch.
      state.deals.unshift(deal);
      renderDeals();
      state.highlightId = null;
      feedEl.firstElementChild && feedEl.firstElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      // The new ask would be hidden by the current pill, so switch to All so it's visible.
      setFilter('All');
      loadDeals();
    }
  }

  function setSubmitting(busy) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Posting…' : 'Post ask';
  }

  function onSubmit(e) {
    e.preventDefault();
    clearFormErrors();

    var payload = readForm();
    var errors = validate(payload);
    if (Object.keys(errors).length) { showFieldErrors(errors); return; }

    setSubmitting(true);
    createDeal(payload)
      .then(function (deal) {
        closePostDialog();
        onCreated(deal);
        toast('Your ask is live.');
      })
      .catch(function (err) {
        if (err.status === 422 && err.body && err.body.fields) {
          showFieldErrors(err.body.fields); // the server is the authority
        } else {
          formErrorEl.textContent = err.status === 0
            ? 'We couldn\'t reach the server, so your ask was not posted. Try again.'
            : 'Something went wrong on our side, so your ask was not posted. Try again.';
          formErrorEl.hidden = false;
        }
      })
      .finally(function () { setSubmitting(false); });
  }

  function initForm() {
    // Fill the sector list from the same array the validator uses.
    var sel = fieldEl('sector');
    var ph = el('option', '', 'Choose a sector');
    ph.value = '';
    sel.appendChild(ph);
    SECTORS.forEach(function (s) { var o = el('option', '', s); o.value = s; sel.appendChild(o); });

    form.addEventListener('submit', onSubmit);
    form.addEventListener('change', function (e) { if (e.target.name === 'funding_type') syncEquityField(); });
    fieldEl('amount_inr').addEventListener('input', syncAmountHelp);
    fieldEl('pitch').addEventListener('input', function () {
      pitchCount.textContent = fieldEl('pitch').value.length + '/' + LIMITS.pitchMax;
    });
    // Clear a field's error as soon as it's edited.
    form.addEventListener('input', function (e) { if (e.target.name) setFieldError(e.target.name, ''); });

    document.getElementById('open-post').addEventListener('click', openPostDialog);
    document.getElementById('close-post').addEventListener('click', closePostDialog);
    document.getElementById('cancel-post').addEventListener('click', closePostDialog);
    // Click on the backdrop (the dialog element itself) closes it.
    dialog.addEventListener('click', function (e) { if (e.target === dialog) closePostDialog(); });
  }

  /* ------------------------------- boot ------------------------------- */

  document.getElementById('logout-btn').addEventListener('click', function () { window.Auth.logout(); });
  initFilters();
  initForm();
  loadDeals();
})();