window.RestReminder = window.RestReminder || {};

window.RestReminder.utils = (function () {
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  var ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (ch) {
      return ESCAPE_MAP[ch];
    });
  }

  function throttle(fn, wait) {
    var last = 0, timer = null, lastArgs = null;
    return function () {
      var now = Date.now();
      lastArgs = arguments;
      if (timer) return;
      var remaining = wait - (now - last);
      if (remaining <= 0) {
        last = now;
        timer = null;
        fn.apply(null, lastArgs);
      } else {
        timer = setTimeout(function () {
          last = Date.now();
          timer = null;
          fn.apply(null, lastArgs);
        }, remaining);
      }
    };
  }

  return { clamp: clamp, $: $, $$: $$, escapeHtml: escapeHtml, throttle: throttle };
})();
