import { faker } from '@faker-js/faker';
import { env } from '../config/env';

/**
 * Test data is always prefixed with RUN_ID (+ worker index) so 5 parallel gate jobs never collide.
 * Faker is seeded from RUN_ID + worker so a failing run's data can be reproduced.
 */
function seedFrom(s: string): number {
  let h = 0;
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export class DataFactory {
  readonly prefix: string;
  private counter = 0;

  constructor(workerIndex: number, testTitle = '') {
    this.prefix = `${env.RUN_ID}-w${workerIndex}`;
    faker.seed(seedFrom(`${this.prefix}:${testTitle}`));
  }

  /** Unique, readable id: "<RUN_ID>-w<worker>-<n>" */
  uid(label = 'id'): string {
    this.counter += 1;
    return `${label}-${this.prefix}-${this.counter}`.replace(/[^a-zA-Z0-9-]/g, '');
  }

  email(domain = 'example.com'): string {
    return `test_user+${this.uid('u')}@${domain}`.toLowerCase();
  }

  user(): { firstName: string; lastName: string; email: string; password: string; phone: string } {
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: this.email(),
      password: `Pw!${faker.string.alphanumeric(10)}9`,
      phone: faker.phone.number({ style: 'national' }),
    };
  }

  address(): { street: string; city: string; zip: string; country: string } {
    return {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      zip: faker.location.zipCode('#####'),
      country: 'United States',
    };
  }

  text(label = 'note'): string {
    return `${this.uid(label)} ${faker.lorem.words(3)}`;
  }
}
