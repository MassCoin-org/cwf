export class CwfRequest {
  cookies: { [key: string]: string };

  constructor(cookies: { [key: string]: string }) {
    this.cookies = cookies;
  }
}
