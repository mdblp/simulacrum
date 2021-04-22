import { describe, it, beforeEach, captureError } from '@effection/mocha';
import { Client, Simulation } from '@simulacrum/client';
import fetch from 'cross-fetch';
import { Task } from 'effection';
import expect from 'expect';

import { echo } from '../src/echo';
import { createHttpApp } from '../src/http';
import { ServerOptions } from '../src/interfaces';

import { createTestServer } from './helpers';

describe('@simulacrum/server', () => {
  let client: Client;

  let app = createHttpApp().post('/', echo);



  beforeEach(function * (world) {
    client = yield createTestServer({
      simulators: {
        echo: () => ({
          services: {
            echo: {
              protocol: 'http',
              app
            },
            ["echo.too"]: {
              protocol: 'http',
              app
            }
          },
          scenarios: {}
        })
      }
    }).run(world).client();
  });

  describe('createSimulation()', () => {
    let simulation: Simulation;

    beforeEach(function*() {
      simulation = yield client.createSimulation("echo");
    });

    it('creates a simulation', function * () {
      expect(typeof simulation.id).toBe('string');
    });

    it('has the echo service', function* () {
      expect(simulation.services).toEqual([
        { name: 'echo', url: expect.stringMatching('http://localhost') },
        { name: 'echo.too', url: expect.stringMatching('http://localhost') }
      ]);
    });

    describe('posting to the echo service', () => {
      let body: string;

      beforeEach(function*() {
        let [{ url }] = simulation.services;

        let response = yield fetch(url.toString(), { method: 'POST', body: "hello world" });
        expect(response.ok).toEqual(true);
        body = yield response.text();
      });

      it('gives you back what you gave it', function*() {
        expect(body).toEqual("hello world");
      });
    });

    describe('destroySimulation()', () => {
      let destroyed: boolean;
      beforeEach(function*() {
        destroyed = yield client.destroySimulation(simulation);
      });

      it('indicates in the response that this operation tore down the simulation', function*() {
        expect(destroyed).toEqual(true);
      });

      it('tears down any running services', function*() {
        let [{ url }] = simulation.services;
        let response = fetch(url.toString(), { method: 'POST', body: "hello world" });
        expect(yield captureError(response)).toMatchObject({ name: 'FetchError' });
      });
    });

  });

  describe('creating a simulation with parameters', () => {
    let simulation: Simulation;
    let echo: (value: string) => Promise<string>;

    beforeEach(function*(world) {
      simulation = yield client.createSimulation("echo", {
        double: true
      });
      let [{ url }] = simulation.services;
      echo = (body) => world.spawn(function*() {
        let response: Response = yield fetch(url.toString(), {
          method: 'POST',
          body
        });
        expect(response.ok).toEqual(true);
        return yield response.text();
      })
    });

    it('can effect the way in which the simulation runs ', function*() {
      expect(yield echo("hello")).toEqual("hellohello");
    });
  });


  describe('creating two servers with the same seed', () => {
    let one: Client;
    let two: Client;
    let options: ServerOptions = {
      seed: 5,
      simulators: {
        empty: () => ({ services: {}, scenarios: {} })
      }
    };

    beforeEach(function*(world) {
      one = yield createTestServer(options).run(world).client();
      two = yield createTestServer(options).run(world).client();
    });

    it('creates simulations with the same uuid', function*() {
      let first = yield one.createSimulation("empty");
      let second = yield two.createSimulation("empty");

      expect(first).toBeDefined();
      expect(second).toBeDefined();

      expect(first).toEqual(second);
    });
  });
});
