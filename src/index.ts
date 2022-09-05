import * as express from "express";
import { Express, Request, Response } from "express";
import { log, LogLevel } from "./log";
import { path as rootPath } from "app-root-path";
import { exists, filesInFolder, getContents } from "./util";
import { parse } from "node-html-parser";
import { WebSocketServer, WebSocket } from "ws";
import * as chokidar from "chokidar";

export class Cwf {
  private expressApp: Express;
  private wss: WebSocketServer;
  private connected: WebSocket[];
  private debug: boolean;

  constructor(debug: boolean) {
    this.expressApp = express();
    this.connected = [];
    this.debug = debug;
    this.setupRoutes();

    if (debug) {
      this.setupHotReload();
    }
  }

  private setupRoutes() {
    this.expressApp.get("/*", (req: Request, res: Response) => {
      const viewName = req.path != "/" ? req.path : "index";
      const viewPath = `${rootPath}/views/${viewName}.cwf`;

      if (exists(viewPath)) {
        res.set("Content-Type", "text/html");

        if (this.debug) {
          const contents = getContents(viewPath);
          const root = parse(contents);
          root
            .querySelector("head")
            .appendChild(
              parse(
                `<script>new WebSocket("ws://127.0.0.1:6167/").onmessage=_=>{fetch(window.location.href,{headers:{"Content-Type":"text/html"}}).then(a=>a.text()).then(a=>{document.querySelector("html").innerHTML=a})}</script>`
              )
            );

          res.send(root.toString());
        } else {
          res.send(getContents(viewPath));
        }
      } else {
        res.send("404");
      }
    });
  }

  private setupHotReload() {
    this.wss = new WebSocketServer({
      port: 6167,
    });

    this.wss.on("listening", () => {
      log(LogLevel.Info, `Hot reload listening on port 6167.`);
    });

    this.wss.on("connection", (ws) => {
      console.log("Connected.".rainbow);
      this.connected.push(ws);
    });

    let views = filesInFolder(`${rootPath}/views`);

    for (let view of views) {
      chokidar.watch(`${rootPath}/views/${view}`).on("change", (_, __) => {
        this.connected.forEach((ws) =>
          ws.send(JSON.stringify({ status: "changed" }))
        );
      });
    }
  }

  listen(port: number = 3000) {
    this.expressApp.listen(port, () => {
      log(LogLevel.Info, `Listening on port ${port}.`);
    });
  }
}

export default function (options?: { debug: boolean }): Cwf {
  return new Cwf(options?.debug || false);
}
