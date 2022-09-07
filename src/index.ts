import * as express from "express";
import { Express, Request, Response } from "express";
import { log, LogLevel } from "./log";
import { path as rootPath } from "app-root-path";
import { exists, filesInFolder, getContents } from "./util";
import { HTMLElement, parse } from "node-html-parser";
import { WebSocketServer, WebSocket } from "ws";
import * as chokidar from "chokidar";
import { CwfRequest } from "./CwfRequest";
import { networkInterfaces } from "os";
import * as cookieParser from "cookie-parser";
import { CwfResponse } from "./CwfResponse";
import { RouteAlreadyHandled } from "./RouteAlreadyHandled";
import { MalformedComponent } from "./MalformedComponent";

export class Cwf {
  private expressApp: Express;
  private wss: WebSocketServer;
  private connected: WebSocket[] = [];
  private debug: boolean;
  private components: {
    [key: string]: [path: string, componentHtml: HTMLElement];
  } = {};
  private customHandledRoutes: {
    [key: string]: (req: Request, res: Response) => void;
  } = {};

  constructor(debug: boolean) {
    this.expressApp = express();
    this.setupExpress();
    this.findComponents();
    this.watchComponents();
    this.setupRoutes();

    this.debug = debug;

    if (debug) {
      this.setupHotReload();
    }
  }

  private setupExpress() {
    this.expressApp.use(cookieParser());
  }

  /**
   * Loads a component into `this.components`.
   *
   * @param componentName The name of the component.
   * @param element The element of the component.
   * @param reReg Marks if we should re-register or error when attempting to.
   */
  private loadComponent(
    componentName: string,
    element: HTMLElement,
    reReg: boolean = false
  ) {
    if (!element) {
      throw new MalformedComponent(
        "The component's root node is not a <comp> tag."
      );
    }
    console.log(element.getAttribute("name"));
    if (!element.hasAttribute("name")) {
      throw new MalformedComponent(
        "The component doesn't have a name attribute."
      );
    }

    // if the component is already registered
    if (!!this.components[componentName] && !reReg) {
      throw new MalformedComponent("This component is already registered.");
    } else if (!!this.components[componentName] && reReg) {
      delete this.components[componentName];
    }

    let componentPath = `${rootPath}/components/${componentName}`;

    this.components[componentName] = [componentPath, element];

    log(LogLevel.Info, `Loaded component ${componentName.bgCyan}`);
  }

  private findComponents() {
    const components = filesInFolder(`${rootPath}/components`);

    for (let component of components) {
      const nameWithoutExt = component.split(".cwf")[0];
      const componentContent = getContents(
        `${rootPath}/components/${component}`
      );

      const parsedElement =
        parse(componentContent).getElementsByTagName("comp")[0];
      this.loadComponent(nameWithoutExt, parsedElement);
    }
  }

  private watchComponents() {
    chokidar
      .watch(`${rootPath}/components`, {
        // bad, but we must, in order to prevent errors... :(
        // TODO: (but not right now): find a way to not use polling... may be a long shot.
        usePolling: true,
      })
      .on("change", (path, __) => {
        let component = parse(getContents(path)).getElementsByTagName(
          "comp"
        )[0];

        this.loadComponent(component.getAttribute("name"), component, true);
        this.broadcastReload();
      });
  }

  /**
   * Shouldn't really be called.
   */
  private refreshComponents() {
    this.components = {};
    this.findComponents();
    log(LogLevel.Info, `Refreshed components.`);
  }

  private getComponentAsDiv(componentName: string): HTMLElement | null {
    const component = this.components[componentName][1];
    if (!component) {
      return null;
    }

    const componentCopy = component;
    componentCopy.tagName = "div";
    componentCopy.removeAttribute("name");
    return componentCopy;
  }

  private replaceComponents(view: HTMLElement) {
    for (let componentName in this.components) {
      const componentCalls = view.getElementsByTagName(
        `Component_${componentName}`
      );

      console.log(componentName);
      for (let componentCall of componentCalls) {
        const divComponent = this.getComponentAsDiv(componentName);
        componentCall.innerHTML = divComponent.innerHTML;
        componentCall.tagName = "div";
      }
    }

    return view.toString();
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
              `<script hot-reload>!function(){let ws=new WebSocket("ws://${ip}:6167/");ws.onmessage=(_=>{fetch(window.location.href,{headers:{"Content-Type":"text/html"}}).then(e=>e.text()).then(r=>{document.body.innerHTML=r,document.querySelectorAll("script").forEach(e=>{console.log(e),""!==e.getAttribute("hot-reload")&&eval(e.textContent)})})})}();</script>`
            )
          );

        res.send(this.replaceComponents(root));
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

      // routes that start with a minus are private, and not meant to be displayed.
      if (req.path.startsWith("/-")) {
        this.renderView("404", res);
        return;
      }

      this.renderView(req.path, res);
    });
  }

  private broadcastReload() {
    this.connected.forEach((ws) =>
      ws.send(JSON.stringify({ status: "changed" }))
    );
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
        this.broadcastReload();
      });
    }
  }

  /**
   * Used to handle the route manually.
   *
   * Can be used for checks before rendering the view using the `renderView` function inside the callback.
   * @param route The route to handle.
   * @param handler The handler for the route.
   */
  handleRoute(
    route: string,
    handler: (
      /**
       * The CwfRequest.
       */
      req: CwfRequest,
      /**
       * The CwfResponse.
       */
      res: CwfResponse,
      /**
       * Renders a view.
       * @param viewName The name of the view. Finds a view with the same name as the path if not defined.
       */
      renderView: (viewName?: string) => void
    ) => void
  ) {
    if (Object.keys(this.customHandledRoutes).includes(route)) {
      throw new RouteAlreadyHandled(
        `The route ${route} is already handled manually.`
      );
    }

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

  /**
   * Starts listening on the provided port, or, if it's not provided, on port 3000.
   * @param port The port.
   */
  listen(port: number = 3000) {
    this.expressApp.listen(port, () => {
      log(LogLevel.Info, `Started server on http://localhost:${port}`);
    });
  }
}

export default function (options?: { debug: boolean }): Cwf {
  return new Cwf(options?.debug || false);
}
