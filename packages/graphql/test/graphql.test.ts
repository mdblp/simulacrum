import { describe, it, beforeEach } from '@effection/mocha';
import { Service } from '@simulacrum/client';
import expect from 'expect';
import { ExecutionResult } from 'graphql';
import https from 'https';
import _fetch, { RequestInit } from 'node-fetch';

import { createTestServer, Client, Simulation } from './helpers';
import { graphql } from '../src';
import { droidNames } from '../src/examples/starwars/simulation/data';

// ignore ssl errors for the purposes of these tests
const agent = new https.Agent({
  rejectUnauthorized: false,
});

interface GraphQLOptions {
  query: string;
  variables?: Record<string, unknown>;
}

describe('GraphQL simulator', () => {
  let client: Client;

  beforeEach(function*() {
    client = yield createTestServer({
      simulators: { graphql }
    });
  });

  describe("Creating a simulation with a GraphQL simulator", () => {
    let service: Service;
    let simulation: Simulation;

    describe("without options", () => {
      beforeEach(function*() {
        simulation = yield client.createSimulation("graphql");
      });

      it('fails', function*() {
        expect(simulation.status).toEqual('failed');
      });
    });

    describe("with a schema, simulated context, and scenarios", () => {
      beforeEach(function*() {
        simulation = yield client.createSimulation("graphql", {
          options: {
            schema: {
              module: "@simulacrum/graphql/dist/examples/starwars",
              export: "schema",
            },
            context: {
              module: "@simulacrum/graphql/dist/examples/starwars",
              export: "context",
            },
            scenarios: {
              module: "@simulacrum/graphql/dist/examples/starwars",
              export: "scenarios",
            }
          }
        });

        service = simulation.services.find(x => x.name === 'graphql') as Service;
      });

      it('succeeds', function*() {
        expect(simulation.status).toEqual('running');
      });

      it('gives the service a url', function*() {
        expect(typeof service.url).toEqual("string");
      });

      describe("handlers", () => {
        let fetch = (endpoint: string, options: RequestInit) => {
          return _fetch(`${service.url}${endpoint}`, { agent, ...options });
        };

        let fetchGraphQL = async (endpoint: string, { query, variables = {} }: GraphQLOptions) => {
          let result = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({ query, variables }),
          });

          return result.json();
        };

        describe("[GET] /", () => {
          it("serves a graphql playground", function*() {
            let result: Response = yield fetch("/", { method: 'GET', agent });
            expect(result.ok).toEqual(true);
            expect(result.headers.get('content-type')).toEqual("text/html");
            expect(yield result.text()).toContain("GraphQL Playground");
          });
        });

        describe("[POST] /", () => {
          it("allows introspection", function*() {
            let { data, errors } = yield fetchGraphQL("/", {
              query: "{ __schema { types { name } } }",
            });
            expect(errors).toBeUndefined();
            expect(data.__schema.types).toEqual(expect.arrayContaining([{ name: "Droid" }]));
          });

          it("responds to queries", function*() {
            let { data, errors } = yield fetchGraphQL("/", {
              query: "{ characters { name } }",
            });
            expect(errors).toBeUndefined();
            expect(data.characters).toEqual([]);
          });

          describe("scenarios", () => {
            let result: ExecutionResult;

            beforeEach(function*() {
              yield client.given(simulation, "droid");

              result = yield fetchGraphQL("/", {
                query: "{ characters { __typename id name } }",
              });
            });

            it("populates the simulated store", function*() {
              expect(result.errors).toBeUndefined();
              expect(result.data?.characters).toHaveLength(1);
              expect(result.data?.characters[0].__typename).toEqual("Droid");
              expect(droidNames).toContain(result.data?.characters[0].name);
            });

            it("returns stable data", function*() {
              let { data, errors } = yield fetchGraphQL("/", {
                query: "query ($id: String!) { droid(id: $id) { name } }",
                variables: { id: result.data?.characters[0].id },
              });
              expect(errors).toBeUndefined();
              expect(data?.droid.name).toEqual(result.data?.characters[0].name);
            });
          });
        });
      });
    });
  });
});
