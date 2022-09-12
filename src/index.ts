import express from 'express';
import { Express, Request, Response } from 'express';
import * as log from './log';
import { path as rootPath } from 'app-root-path';
import { exists, filesInFolder, getContents } from './util';
import { HTMLElement, parse } from 'node-html-parser';
import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import { CwfRequest } from './CwfRequest';
import { networkInterfaces } from 'os';
import cookieParser from 'cookie-parser';
import { CwfResponse } from './CwfResponse';
import { RouteAlreadyHandled } from './RouteAlreadyHandled';
import { MalformedComponent } from './MalformedComponent';
import path from 'path';
import { Server } from 'http';
import { ApiContext } from './ApiContext';
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
  private server: Server;

  constructor(debug: boolean) {
    this.expressApp = express();
    this.setupExpress();
    this.findComponents();
    this.setupRoutes();

    this.debug = debug;

    if (debug) {
      this.setupHotReload();
      this.watchComponents();
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

    // if the component is already registered
    if (!!this.components[componentName] && !reReg) {
      throw new MalformedComponent('This component is already registered.');
    } else if (!!this.components[componentName] && reReg) {
      delete this.components[componentName];
    }

    let componentPath = `${rootPath}/components/${componentName}`;

    this.components[componentName] = [componentPath, element];

    if (reReg) {
      log.info(`Reloaded component ${componentName.bgCyan}.`);
      return;
    }

    log.info(`Loaded component ${componentName.bgCyan}.`);
  }

  private findComponents() {
    if (!exists(`${rootPath}/components`)) {
      return;
    }

    const components = filesInFolder(`${rootPath}/components`);

    for (let component of components) {
      const nameWithoutExt = component.split('.cwf')[0];
      const componentContent = getContents(
        `${rootPath}/components/${component}`
      );

      const parsedElement =
        parse(componentContent).getElementsByTagName('comp')[0];

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
      .on('change', (compPath, __) => {
        let component = parse(getContents(compPath)).getElementsByTagName(
          'comp'
        )[0];

        const pathSplitted = compPath.split(path.sep);

        let componentName =
          pathSplitted[pathSplitted.length - 1].split('.cwf')[0];

        this.loadComponent(componentName, component, true);
        this.broadcastReload();
      });
  }

  /**
   * Shouldn't really be called.
   */
  private async refreshComponents() {
    this.components = {};
    this.findComponents();
    log.info(`Refreshed components.`);
  }

  private async getComponentAsDiv(
    componentName: string
  ): Promise<HTMLElement | null> {
    const component = this.components[componentName][1];
    if (!component) {
      return null;
    }

    const componentCopy = component;
    componentCopy.tagName = 'div';
    componentCopy.removeAttribute('name');
    return componentCopy;
  }

  private async replaceComponents(view: HTMLElement) {
    for (let componentName in this.components) {
      const componentCalls = view.getElementsByTagName(
        `Component_${componentName}`
      );

      for (let componentCall of componentCalls) {
        const divComponent = await this.getComponentAsDiv(componentName);
        componentCall.innerHTML = divComponent.innerHTML;
        componentCall.tagName = 'div';
      }
    }

    return view.toString();
  }

  private async renderView(viewName: string, res: Response) {
    viewName = viewName === '/' ? 'index' : viewName;
    const viewPath = `${rootPath}/views/${viewName}.cwf`;

    if (exists(viewPath)) {
      // add hot reloading when in debug mode
      if (this.debug) {
        const contents = getContents(viewPath);
        const root = parse(contents);
        const ip = Object.values(networkInterfaces())
          .flat()
          .find((i) => i.family == 'IPv4' && !i.internal).address;

        root
          .querySelector('head')
          .appendChild(
            parse(
              `<script live-reload>"use strict";(function(){let e=new WebSocket("ws://${ip}:6167/");e.onmessage=(e=>{fetch(window.location.href,{headers:{"Content-Type":"text/html"}}).then(e=>e.text()).then(e=>{console.log("[Live Reload] Reloading..."),window.location.reload()})})})();</script>`
            )
          );

        res.send(await this.replaceComponents(root));
      } else {
        res.send(getContents(viewPath));
      }
    } else {
      if (exists(`${rootPath}/views/404.cwf`)) {
        await this.renderView('404', res);
      } else {
        res.send('404');
      }
    }
  }

  private async setupRoutes() {
    this.expressApp.all('/*', async (req: Request, res: Response) => {
      if (Object.keys(this.customHandledRoutes).includes(req.path)) {
        this.customHandledRoutes[req.path](req, res);
        return;
      }

      // routes that start with a minus are private, and not meant to be displayed.
      if (req.path.startsWith('/-')) {
        await this.renderView('404', res);
        return;
      } else if (req.path.startsWith('/api')) {
        // warning: weird code ahead!
        // but it works, as of 9/10/22
        const splitted = req.path.split('/api/')[1];

        let fileName = splitted.endsWith('/')
          ? splitted.slice(0, -1)
          : splitted;

        let filePath =
          rootPath +
          `${path.sep}views${path.sep}api${path.sep}` +
          fileName +
          '.ts';

        try {
          await import(filePath);
        } catch (err) {
          await this.renderView('404', res);
          return;
        }

        // the API definition (file)
        let apiDefinition: { default: (ctx: ApiContext) => Promise<void> } =
          await import(filePath);

        const ctx = new ApiContext(req.method, req.headers);

        ctx.send = (...args: any[]) => res.send(...args);
        ctx.sendJson = (...args: any[]) => res.json(...args);

        await apiDefinition.default(ctx);

        return;
      }

      if (req.method == 'GET') {
        await this.renderView(req.path, res);
      }
    });
  }

  private broadcastReload() {
    this.connected.forEach((ws) =>
      ws.send(JSON.stringify({ status: 'changed' }))
    );
  }

  private async setupHotReload() {
    if (!exists(`${rootPath}/views`)) {
      return;
    }

    this.wss = new WebSocketServer({
      port: 6167,
    });

    this.wss.on('listening', () => {
      log.info(`Hot reload listening on port 6167.`);
    });

    this.wss.on('connection', (ws) => {
      console.log('Connected.'.rainbow);
      this.connected.push(ws);
    });

    let views = filesInFolder(`${rootPath}/views`);

    for (let view of views) {
      chokidar.watch(`${rootPath}/views/${view}`).on('change', (_, __) => {
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
  async handleRoute(
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

    this.customHandledRoutes[route] = async (req: Request, res: Response) => {
      const renderView = async (viewName?: string) => {
        if (!viewName) {
          await this.renderView(req.path, res);
          return;
        }

        await this.renderView(viewName, res);
      };

      const cwfRequest = new CwfRequest(req.cookies);
      const cwfResponse = new CwfResponse(res);

      handler(cwfRequest, cwfResponse, renderView);
    };
  }

  /**
   * Starts listening on the provided port, or, if it's not provided, on port 3000.
   * @param port The port.
   */
  async listen(port: number = 3000) {
    this.server = this.expressApp.listen(port, () => {
      log.info(`Started server on http://localhost:${port}`);
    });
  }

  /**
   * Destroys the Cwf listener.
   *
   * Created for the unit tests.
   */
  destroy() {
    if (this.server !== undefined) {
      this.server.unref();
    }
  }
}

export default function (options?: { debug: boolean }): Cwf {
  return new Cwf(options?.debug || false);
}

export { CwfRequest, CwfResponse, ApiContext };
