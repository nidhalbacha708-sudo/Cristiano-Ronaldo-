/* XVX: Turnstile widget inside the key / login form.
   The server refuses every code until a Turnstile token has been verified (single-use). */
(function () {
  var W = { id: null };
  function loadApi() {
    return new Promise(function (ok, no) {
      if (window.turnstile) return ok();
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true; s.onload = function () { ok(); }; s.onerror = no;
      document.head.appendChild(s);
    });
  }
  function mount() {
    var form = document.getElementById('loginForm');
    if (!form || form.querySelector('.xvx-ts')) return;
    var box = document.createElement('div');
    box.className = 'xvx-ts'; box.style.cssText = 'margin:14px 0;display:flex;justify-content:center;min-height:65px';
    var btn = form.querySelector('button[type=submit]');
    form.insertBefore(box, btn || null);
    fetch('/api/ts-key', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.key) throw 0;
      return loadApi().then(function () { W.id = window.turnstile.render(box, { sitekey: d.key, theme: 'dark' }); });
    }).catch(function () { box.textContent = 'تعذّر تحميل التحقق. أعد تحميل الصفحة.'; box.style.color = '#ff6b6b'; });
  }
  window.XVXTS = {
    token: function () { try { return W.id !== null ? (window.turnstile.getResponse(W.id) || '') : ''; } catch (e) { return ''; } },
    reset: function () { try { if (W.id !== null) window.turnstile.reset(W.id); } catch (e) {} }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
