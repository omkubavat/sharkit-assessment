/**
 * auth.js — the entire auth story for this demo.
 *
 * Scope decision: the brief asks for ONE seeded user and a plain "does it match?"
 * check, with login state kept in localStorage. So there is no token/JWT layer.
 * Trade-off (worth saying in the walkthrough): the credentials live in client
 * code and are therefore visible to anyone. That is acceptable for a demo login
 * whose only job is to gate the UI; real auth would verify on the server.
 *
 * Exposes window.Auth for other pages:
 *   Auth.isLoggedIn()   -> boolean
 *   Auth.requireAuth()  -> redirects to login.html if not signed in (call on index.html)
 *   Auth.logout()       -> clears session and returns to login.html
 */
(function () {
  'use strict';

  var SESSION_KEY = 'askboard.session';
  var FEED_PAGE = 'index.html';
  var LOGIN_PAGE = 'login.html';

  // Seeded user — must match the credentials documented in the README.
  var DEMO_USER = {
    email: 'founder@askboard.demo',
    password: 'Demo@1234',
    name: 'Demo Founder'
  };

  /* ---------- session helpers ---------- */

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    var s = getSession();
    return !!(s && s.email === DEMO_USER.email);
  }

  function startSession() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        email: DEMO_USER.email,
        name: DEMO_USER.name,
        at: Date.now()
      }));
      return true;
    } catch (e) {
      return false; // storage blocked: we cannot remember the login
    }
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    window.location.replace(LOGIN_PAGE);
  }

  function requireAuth() {
    if (!isLoggedIn()) window.location.replace(LOGIN_PAGE);
  }

  /* ---------- validation ---------- */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate(email, password) {
    var errors = {};
    if (!email) errors.email = 'Enter your email address.';
    else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address, like you@company.com.';
    if (!password) errors.password = 'Enter your password.';
    return errors;
  }

  function credentialsMatch(email, password) {
    return email.toLowerCase() === DEMO_USER.email && password === DEMO_USER.password;
  }

  /* ---------- login page wiring ---------- */

  function initLoginForm() {
    var form = document.getElementById('login-form');
    if (!form) return; // not the login page

    var emailEl = document.getElementById('email');
    var passEl = document.getElementById('password');
    var emailErr = document.getElementById('email-error');
    var passErr = document.getElementById('password-error');
    var formErr = document.getElementById('form-error');
    var submitBtn = document.getElementById('submit-btn');
    var revealBtn = document.getElementById('toggle-password');
    var fillBtn = document.getElementById('fill-demo');

    function showFieldError(input, el, message) {
      if (message) {
        el.textContent = message;
        el.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', el.id);
      } else {
        el.hidden = true;
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    }

    function clearErrors() {
      showFieldError(emailEl, emailErr, '');
      showFieldError(passEl, passErr, '');
      formErr.hidden = true;
    }

    // Clear a field's error as soon as the user edits it.
    emailEl.addEventListener('input', function () { showFieldError(emailEl, emailErr, ''); formErr.hidden = true; });
    passEl.addEventListener('input', function () { showFieldError(passEl, passErr, ''); formErr.hidden = true; });

    revealBtn.addEventListener('click', function () {
      var show = passEl.type === 'password';
      passEl.type = show ? 'text' : 'password';
      revealBtn.textContent = show ? 'Hide' : 'Show';
      revealBtn.setAttribute('aria-pressed', String(show));
    });

    fillBtn.addEventListener('click', function () {
      emailEl.value = DEMO_USER.email;
      passEl.value = DEMO_USER.password;
      clearErrors();
      submitBtn.focus();
    });

    form.addEventListener('submit', function (evt) {
      evt.preventDefault();
      clearErrors();

      var email = emailEl.value.trim();
      var password = passEl.value;
      var errors = validate(email, password);

      if (errors.email || errors.password) {
        showFieldError(emailEl, emailErr, errors.email);
        showFieldError(passEl, passErr, errors.password);
        (errors.email ? emailEl : passEl).focus();
        return;
      }

      if (!credentialsMatch(email, password)) {
        // One generic message: do not reveal which of the two was wrong.
        formErr.textContent = "That email and password don't match the demo account.";
        formErr.hidden = false;
        passEl.select();
        return;
      }

      if (!startSession()) {
        formErr.textContent = 'Your browser is blocking local storage, so we can\'t keep you signed in. Allow storage for this site and try again.';
        formErr.hidden = false;
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in…';
      window.location.replace(FEED_PAGE);
    });

    // Already signed in? Skip straight to the feed.
    if (isLoggedIn()) window.location.replace(FEED_PAGE);
  }

  // Pages that need a session opt in with <html data-requires-auth>. Because this file
  // loads synchronously in <head>, the redirect happens before the page paints.
  if (document.documentElement.hasAttribute('data-requires-auth')) requireAuth();

  document.addEventListener('DOMContentLoaded', initLoginForm);

  window.Auth = { isLoggedIn: isLoggedIn, requireAuth: requireAuth, logout: logout };
})();
