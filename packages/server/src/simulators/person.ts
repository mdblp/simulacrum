import type { Slice } from '@effection/atom';
import type { Operation } from 'effection';
import { v4 } from 'uuid';
import type { Faker } from '../faker';
import type { Behaviors, Store } from "../interfaces";

export default function(): Behaviors {
  return {
    services: {},
    scenarios: { person }
  };
}

export interface Person {
  id: string;
  name: string;
  email?: string;
  password?: string;
  picture?: string;
  user_metadata?: Record<string, any>
}

export type OptionalParams<T extends { id: string }> = Partial<Omit<T, 'id'>>;

export function person(store: Store, faker: Faker, params: Partial<Person> = {}): Operation<Person> {
  return function*() {
    let id =  v4().split('-').join('');
    if (params.id) {
      id = params.id;
    }
    let slice = records(store).slice(id);

    let name = params.name ?? faker.name.findName();

    // this is the lamest data generation ever :)
    let attrs = {
      id,
      name,
      email: params.email ?? faker.internet.email(name).toLowerCase(),
      password: params.password ?? faker.internet.password(),
      user_metadata: params.user_metadata
    };

    slice.set(attrs);
    return attrs;
  };
}

function records(store: Store): Slice<Record<string, Record<string, unknown>>> {
  let people = store.slice("people");

  // atom doesn't quite work right in the sense that we can't make a
  // deep slice and have it create parents on demand.
  if (!people.get()) {
    people.set({});
  }
  return people;
}
