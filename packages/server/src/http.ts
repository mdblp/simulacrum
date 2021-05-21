import { Operation, once, Resource, spawn } from 'effection';
import { Request, Response, Application, NextFunction } from 'express';
import type { Server as HTTPServer } from 'http';
import type { AddressInfo } from 'net';
export type { AddressInfo } from 'net';
import { paths } from './config/paths';
import type { ServerOptions as SSLOptions } from 'https';
import { createServer as createHttpsServer } from 'https';

import fs from 'fs';
import { ServiceDetails } from './interfaces';

export interface Server {
  http: HTTPServer;
  address: AddressInfo;
}

export interface ServerOptions {
  port?: number
  protocol: ServiceDetails['protocol']
}

const ssl: SSLOptions = {
  key: fs.readFileSync(
    paths.ssl.keyFile

  ),
  cert: fs.readFileSync(paths.ssl.pemFile),
} as const;

const createAppServer = (app: Application, options: ServerOptions) => {
  switch(options.protocol) {
    case 'http':
      return app.listen(options.port);
    case 'https':
      let httpsServer = createHttpsServer(ssl, app);

      return httpsServer.listen(options.port);
  }
};

export function createServer(app: Application, options: ServerOptions): Resource<Server> {
  return {
    *init() {

      let server = createAppServer(app, options);

      yield spawn(function*() {
        let error: Error = yield once(server, 'error');
        throw error;
      });

      yield spawn(function*() {
        try {
          yield;
        } finally {
          server.close();
        }
      });

      if (!server.listening) {
        yield once(server, 'listening');
      }

      return {
        http: server,
        address: server.address() as AddressInfo
      };
    }
  };
}

export interface HttpHandler {
  (request: Request, response: Response, next?: NextFunction): Operation<void>;
}

export type RouteHandler = {
  method: 'get' | 'post' | 'put';
  path: string;
  handler: HttpHandler;
}

export type Middleware = (req: Request, res: Response, next: NextFunction) => void;

export interface HttpApp {
  handlers: RouteHandler[];
  middleware: Middleware[];
  get(path: string, handler: HttpHandler): HttpApp;
  put(path: string, handler: HttpHandler): HttpApp;
  post(path: string, handler: HttpHandler): HttpApp;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  use(middleware: Middleware): HttpApp;
}

export function createHttpApp(handlers: RouteHandler[] = [], middlewareHandlers: Middleware[] = []): HttpApp {
  function append(handler: RouteHandler) {
    return createHttpApp(handlers.concat(handler), middlewareHandlers);
  }
  function addMiddleware(middleware: Middleware) {
    return createHttpApp(handlers, middlewareHandlers.concat(middleware));
  }
  return {
    handlers,
    middleware: middlewareHandlers,
    get: (path, handler) => append({ path, handler, method: 'get' }),
    post: (path, handler) => append({ path, handler, method: 'post' }),
    put: (path, handler) => append({ path, handler, method: 'put' }),
    use: (middleware) => addMiddleware(middleware)
  };
}
