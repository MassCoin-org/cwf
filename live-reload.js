'use strict';
(function () {
  let ws = new WebSocket('ws://${ip}:6167/');

  ws.onmessage = (_) => {
    fetch(window.location.href, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
      .then((r) => r.text())
      .then((_) => {
        console.log('[Live Reload] Reloading...');
        window.location.reload();
      });
  };
})();
