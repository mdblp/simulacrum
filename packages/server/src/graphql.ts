import { main } from '@effection/node';
import { envelop, useSchema } from '@envelop/core';
import { json } from 'express';
import graphQLPlaygroundMiddlewareExpress from 'graphql-playground-middleware-express';

import { createSimulationServer, Server, createHttpApp } from '.';
import { schema as starwarsSchema } from './starwars-schema';

const { parse, validate, schema, contextFactory, execute } = envelop({
  plugins: [
    useSchema(starwarsSchema)
  ]
})();

main(function*() {
  let server: Server = yield createSimulationServer({
    simulators: {
      graphql: () => ({
        services: {
          graphql: {
            protocol: 'https',
            app: createHttpApp()
              .use(json())
              .get("/", function*(req, res) {
                graphQLPlaygroundMiddlewareExpress({})(req, res, () => {});
              })
              .post("/", function*(req, res) {
                let { query, variables } = req.body;
                let document = parse(query);
                let errors = validate(schema, document);
                if (errors.length > 0) {
                  res.write(JSON.stringify({ errors }));
                } else {
                  let contextValue = yield Promise.resolve(contextFactory());
                  let result = yield Promise.resolve(execute({
                    document,
                    schema,
                    variableValues: variables,
                    contextValue,
                  }));
                  res.write(JSON.stringify(result));
                }
              })
          }
        },
        scenarios: {}
      })
    },
    port: 5000
  });

  console.log(`server running on http://localhost:${server.address.port}`);

  yield;
});