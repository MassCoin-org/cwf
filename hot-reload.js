(function () {
  let ws = new WebSocket('ws://${ip}:6167/');

  ws.onmessage = (_) => {
    fetch(window.location.href, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
      .then((r) => r.text())
      .then((r) => {
        console.log('[Hot Reload] Reloading (1/2)...');
        document.documentElement.innerHTML = r;

        document.querySelectorAll('script').forEach((e) => {
          console.log('[Hot Reload] Reloading (2/2)...');
          if (e.getAttribute('hot-reload') !== '') {
            eval(e.textContent);
          }
        });
      });
  };
})();
