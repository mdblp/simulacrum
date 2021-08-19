/* eslint-disable @typescript-eslint/no-namespace */
/// <reference types="cypress" />

import { Auth0ClientOptions } from '@auth0/auth0-spa-js';
import { Client, createClient, Simulation } from '@simulacrum/client';
import { auth0Client } from './auth';
import { assert } from 'assert-ts';

export interface Person { email: string; password: string }

interface Token {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  access_token: Record<string, any>;
  expires_in: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  id_token: Record<string, any>
}

declare global {
  namespace Cypress {
    interface Chainable {
      createSimulation(options: Auth0ClientOptions): Chainable<Simulation>;
      login(person?: Person): Chainable<Token>;
      logout(): Chainable<void>;
      given(attrs?: Partial<Person>): Chainable<Person>;
      out<S = unknown>(msg: string): Chainable<S>
    }
  }
}

const ClientPort = process.env.PORT || 4000;

const ClientMap: Map<string, Client> = new Map();

Cypress.Commands.add('createSimulation', (options: Auth0ClientOptions) => {
  let client: Client | undefined;

  if (ClientMap.has(Cypress.spec.name)) {
    client = ClientMap.get(Cypress.spec.name);
  } else {
    client = createClient(`http://localhost:${ClientPort}`);
    ClientMap.set(Cypress.spec.name, client);
  }

  assert(typeof client !== 'undefined', 'no client created in createSimulation');

  let { domain, client_id, ...auth0Options } = options;

  assert(typeof domain !== 'undefined', 'domain is a required option');

  let port = Number(domain.split(':').slice(-1)[0]);

  return cy.wrap(
      client.createSimulation("auth0", {
        options: {
          ...auth0Options,
          clientId: client_id,
        },
        services: {
          auth0: {
            port,
          },
        },
      })
  ).then((simulation) => ({ client, simulation }));
});

Cypress.Commands.add('given', { prevSubject: true }, (simulation: Simulation, attrs: Partial<Person> = {}) => {
  let client = ClientMap.get(Cypress.spec.name);

  assert(typeof client !== 'undefined', 'no client in given');

  return cy.wrap(client.given(simulation, "person", attrs).then(scenario => scenario.data));
});

Cypress.Commands.add('login', { prevSubject: 'optional' }, (person) => {
  return cy.wrap(auth0Client.getTokenSilently({ ignoreCache: true, currentUser: person.email }));
});

Cypress.Commands.add('logout', () => {
  return cy.wrap(auth0Client.logout());
});


export { };
