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
        console.log('[Hot Reload] Reloading...');
        document.documentElement.innerHTML = r;
        console.log('[Hot Reload] Done!');
      });
  };
})();
