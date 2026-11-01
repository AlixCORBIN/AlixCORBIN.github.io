// Site en maintenance : bannière et blocage des écritures vers la base, le temps de la bascule.
// Les lectures GET restent possibles. Retirer ce script et ses balises après la bascule.
(function () {
  var HOSTS = /(^|\.)supabase\.co$|^api\.alixcorbin\.com$/;
  var MESSAGE = 'Site en maintenance : les actions sont temporairement désactivées.';

  function blocked(url, method) {
    var m = String(method || 'GET').toUpperCase();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false;
    try { return HOSTS.test(new URL(String(url), location.href).hostname); } catch (e) { return false; }
  }

  var realFetch = window.fetch;
  if (realFetch) {
    window.fetch = function (input, init) {
      var isReq = typeof Request !== 'undefined' && input instanceof Request;
      var url = isReq ? input.url : input;
      var method = (init && init.method) || (isReq ? input.method : 'GET');
      if (blocked(url, method)) {
        return Promise.resolve(new Response(JSON.stringify({ message: MESSAGE, error: 'maintenance' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      return realFetch.apply(this, arguments);
    };
  }

  if (window.XMLHttpRequest) {
    var open = XMLHttpRequest.prototype.open;
    var send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__maintenance = blocked(url, method);
      return open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      if (this.__maintenance) { this.abort(); return; }
      return send.apply(this, arguments);
    };
  }

  if (navigator.sendBeacon) {
    var beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      return blocked(url, 'POST') ? false : beacon(url, data);
    };
  }

  function banner() {
    if (!document.body || document.getElementById('maintenance-banner')) return;
    var b = document.createElement('div');
    b.id = 'maintenance-banner';
    b.setAttribute('role', 'status');
    b.textContent = MESSAGE;
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:10px 16px;background:#b45309;color:#fff;font:600 14px/1.4 system-ui,sans-serif;text-align:center';
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner);
  else banner();
})();
