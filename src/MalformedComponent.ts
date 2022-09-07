export class MalformedComponent extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedComponent';
  }
}
