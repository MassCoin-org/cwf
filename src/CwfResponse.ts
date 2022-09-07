import { Response } from 'express';

export class CwfResponse {
  /**
   * The Express response.
   */
  _express: Response;

  constructor(_express: Response) {
    this._express = _express;
  }
}
