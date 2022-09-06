import * as express from "express";
import { Express, Request, Response } from "express";
import { log, LogLevel } from "./log";
import { path as rootPath } from "app-root-path";
import { exists, filesInFolder, getContents } from "./util";
import { parse } from "node-html-parser";
import { WebSocketServer, WebSocket } from "ws";
import * as chokidar from "chokidar";
import { CwfRequest } from "./CwfRequest";
import { networkInterfaces } from "os";
import * as cookieParser from "cookie-parser";
import { CwfResponse } from "./CwfResponse";

export class Cwf {
  private expressApp: Express;
  private wss: WebSocketServer;
  private connected: WebSocket[] = [];
  private debug: boolean;
  private customHandledRoutes: {
    [key: string]: (req: Request, res: Response) => void;
  } = {};

  constructor(debug: boolean) {
    this.expressApp = express();
    this.setupExpress();
    this.setupRoutes();

    this.debug = debug;

    if (debug) {
      this.setupHotReload();
    }
  }

  private setupExpress() {
    this.expressApp.use(cookieParser());
  }

  private renderView(viewName: string, res: Response) {
    viewName = viewName === "/" ? "index" : viewName;
    const viewPath = `${rootPath}/views/${viewName}.cwf`;

    if (exists(viewPath)) {
      // add hot reloading when in debug mode
      if (this.debug) {
        const contents = getContents(viewPath);
        const root = parse(contents);
        const ip = Object.values(networkInterfaces())
          .flat()
          .find((i) => i.family == "IPv4" && !i.internal).address;

        root
          .querySelector("head")
          .appendChild(
            parse(
              `<script hot-reload>!function(){let ws;new WebSocket("ws://${ip}:6167/").onmessage=_=>{fetch(window.location.href,{headers:{"Content-Type":"text/html"}}).then(a=>a.text()).then(r=>{document.body.innerHTML=r,document.querySelectorAll("script").forEach(e=>{console.log(e),""!==e.getAttribute("hot-reload")&&eval(e.textContent)})})}}()</script>`
            )
          );

        res.send(root.toString());
      } else {
        res.send(getContents(viewPath));
      }
    } else {
      if (exists(`${rootPath}/views/404.cwf`)) {
        this.renderView("404", res);
      } else {
        res.send("404");
      }
    }
  }

  private setupRoutes() {
    this.expressApp.get("/*", (req: Request, res: Response) => {
      if (Object.keys(this.customHandledRoutes).includes(req.path)) {
        this.customHandledRoutes[req.path](req, res);
        return;
      }

      this.renderView(req.path, res);
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

  /**
   * Used to handle the route manually.
   *
   * Can be used for checks before rendering the view using the `renderView` function inside the callback.
   * @param route
   * @param handler
   */
  handleRoute(
    route: string,
    handler: (
      req: CwfRequest,
      res: CwfResponse,
      /**
       * Renders a view.
       * @param viewName The name of the view. Finds a view with the same name as the path if not defined.
       */
      renderView: (viewName?: string) => void
    ) => void
  ) {
    this.customHandledRoutes[route] = (req: Request, res: Response) => {
      const renderView = (viewName?: string) => {
        if (!viewName) {
          this.renderView(req.path, res);
          return;
        }

        this.renderView(viewName, res);
      };

      const cookies: { [key: string]: string } = {};

      // converting the weird type to an object
      for (let cookie in req.cookies) {
        cookies[cookie] = req.cookies[cookie];
      }

      const cwfRequest = new CwfRequest(req.cookies);
      const cwfResponse = new CwfResponse(res);

      handler(cwfRequest, cwfResponse, renderView);
    };
  }

  listen(port: number = 3000) {
    this.expressApp.listen(port, () => {
      log(LogLevel.Info, `Started server on http://localhost:${port}`);
    });
  }
}

export default function (options?: { debug: boolean }): Cwf {
  return new Cwf(options?.debug || false);
}
