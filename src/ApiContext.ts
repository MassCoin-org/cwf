export class ApiContext {
  method: string;
  headers: string;

  constructor(method: string) {
    this.method = method;
  }
}
