import { IncomingHttpHeaders } from 'http';

export class ApiContext {
  /**
   * The request method.
   */
  method: string;
  /**
   * The request headers.
   *
   * @see https://microsoft.github.io/PowerBI-JavaScript/interfaces/_node_modules__types_node_http_d_._http_.incominghttpheaders.html
   */
  headers: IncomingHttpHeaders;
  /**
   * Sends the HTTP response.
   *
   * @see https://expressjs.com/en/api.html#res.send
   */
  send: (...args: any[]) => void;
  /**
   * Sends the JSON response.
   *
   * @see https://expressjs.com/en/api.html#res.json
   */
  sendJson: (...args: any[]) => void;

  constructor(method: string, headers: IncomingHttpHeaders) {
    this.method = method;
    this.headers = headers;
  }
}
