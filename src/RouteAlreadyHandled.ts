export class RouteAlreadyHandled extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RouteAlreadyHandled';
  }
}
