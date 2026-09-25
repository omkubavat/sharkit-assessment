/**
 * theme.js — dark / light mode.
 *
 * Loaded synchronously in <head>, so the saved theme is applied BEFORE first
 * paint (no flash of the wrong theme). The toggle button is bound once the DOM
 * is ready. Default is dark (the brand's native look); a saved choice wins.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'askboard.theme';
  var META_COLORS = { dark: '#070D17', light: '#EEF4FC' };
  var root = document.documentElement;

  function readSaved() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) {
      return null; // storage blocked (private mode etc.) — fall back to default
    }
  }

  function save(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* non-fatal */ }
  }

  function current() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function syncButtons(theme) {
    var next = theme === 'light' ? 'dark' : 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(theme === 'light'));
      btn.setAttribute('aria-label', 'Switch to ' + next + ' mode');
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', META_COLORS[theme]);
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    syncButtons(theme);
  }

  function toggle() {
    var next = current() === 'light' ? 'dark' : 'light';
    apply(next);
    save(next);
  }

  // Apply immediately (runs in <head>, before the body exists).
  root.setAttribute('data-theme', readSaved() || 'dark');

  document.addEventListener('DOMContentLoaded', function () {
    syncButtons(current());
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', toggle);
    });
  });

  window.Theme = { toggle: toggle, current: current };
})();
