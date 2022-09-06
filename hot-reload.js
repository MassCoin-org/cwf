(function () {
  let ws = new WebSocket("ws://${ip}:6167/");

  ws.onmessage = (_) => {
    fetch(window.location.href, {
      headers: {
        "Content-Type": "text/html",
      },
    })
      .then((r) => r.text())
      .then((r) => {
        document.body.innerHTML = r;

        document.querySelectorAll("script").forEach((e) => {
          console.log(e);
          if (e.getAttribute("hot-reload") !== "") {
            eval(e.textContent);
          }
        });
      });
  };
})();
