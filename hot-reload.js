(function () {
  let ws = new WebSocket("ws://127.0.0.1:6167/");

  ws.onmessage = (_) => {
    fetch(window.location.href, {
      headers: {
        "Content-Type": "text/html",
      },
    })
      .then((r) => r.text())
      .then((r) => {
        document.querySelector("html").innerHTML = r;
      });
  };
})();
