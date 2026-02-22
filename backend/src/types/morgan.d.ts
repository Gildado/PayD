declare module 'morgan' {
  import { RequestHandler } from 'express';

  type Format = string | ((tokens: any, req: any, res: any) => string);

  function morgan(format?: Format, options?: any): RequestHandler;
  export = morgan;
}
