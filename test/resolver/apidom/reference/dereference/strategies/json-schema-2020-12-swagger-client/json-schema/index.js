import path from 'node:path';
import { toValue } from '@swagger-api/apidom-core';
import {
  isJSONSchemaElement,
  isBooleanJsonSchemaElement,
  mediaTypes,
} from '@swagger-api/apidom-ns-json-schema-2020-12';
import { evaluate } from '@swagger-api/apidom-json-pointer';
import { dereference } from '@swagger-api/apidom-reference/configuration/empty';

import * as jestSetup from '../__utils__/jest.local.setup.js';

const rootFixturePath = path.join(__dirname, '__fixtures__');

const dereferenceFixture = (fixture, options = {}) =>
  dereference(path.join(rootFixturePath, fixture, 'root.json'), {
    parse: { mediaType: mediaTypes.latest('json') },
    ...options,
  });

const loadDereferenced = (fixture) =>
  globalThis.loadJsonFile(path.join(rootFixturePath, fixture, 'dereferenced.json'));

const collect$dynamicRefs = (value, pointer = '', acc = []) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collect$dynamicRefs(item, `${pointer}/${index}`, acc));
  } else if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      if (key === '$dynamicRef') acc.push([pointer, item]);
      collect$dynamicRefs(item, `${pointer}/${key}`, acc);
    });
  }
  return acc;
};

describe('dereference', () => {
  beforeAll(() => {
    jestSetup.beforeAll();
  });

  afterAll(() => {
    jestSetup.afterAll();
  });

  describe('strategies', () => {
    describe('json-schema-2020-12-swagger-client', () => {
      describe('JSON Schema - $ref keyword', () => {
        describe('given schemas pointing internally only', () => {
          test('should dereference', async () => {
            const actual = await dereferenceFixture('internal-only');

            expect(toValue(actual)).toEqual(loadDereferenced('internal-only'));
          });

          test('should apply semantics to the dereferenced schema', async () => {
            const dereferenced = await dereferenceFixture('internal-only');
            const fragment = evaluate('/0/properties/user/properties/profile', dereferenced);

            expect(isJSONSchemaElement(fragment)).toBe(true);
          });
        });

        describe('given schemas pointing externally only', () => {
          test('should dereference', async () => {
            const actual = await dereferenceFixture('external-only');

            expect(toValue(actual)).toEqual(loadDereferenced('external-only'));
          });

          test('should apply semantics to the external fragment', async () => {
            const dereferenced = await dereferenceFixture('external-only');
            const fragment = evaluate('/0/properties/user', dereferenced);

            expect(isJSONSchemaElement(fragment)).toBe(true);
          });
        });

        describe('given schemas pointing internally and externally', () => {
          test('should dereference', async () => {
            const actual = await dereferenceFixture('internal-external');

            expect(toValue(actual)).toEqual(loadDereferenced('internal-external'));
          });
        });

        describe('given schemas with internal cycles', () => {
          test('should dereference', async () => {
            const dereferenced = await dereferenceFixture('cycle-internal');
            const parent = evaluate('/0/properties/parent', dereferenced);
            const cyclicParent = evaluate('/0/properties/parent/properties/parent', dereferenced);

            expect(parent).toStrictEqual(cyclicParent);
          });
        });

        describe('given schemas with external cycles', () => {
          test('should dereference with circular structure', async () => {
            const dereferenced = await dereferenceFixture('cycle-external');
            const parent = evaluate(
              '/0/properties/user/properties/profile/properties/parent',
              dereferenced
            );

            expect(toValue(parent)).toHaveProperty('type', 'object');
            expect(toValue(parent)).toHaveProperty('properties');
          });
        });

        describe('given a $ref to an $anchor in the same document', () => {
          test('should dereference', async () => {
            const actual = await dereferenceFixture('anchor-internal');

            expect(toValue(actual)).toEqual(loadDereferenced('anchor-internal'));
          });
        });

        describe('given a $ref to an $anchor in another document', () => {
          test('should dereference', async () => {
            const actual = await dereferenceFixture('anchor-external');

            expect(toValue(actual)).toEqual(loadDereferenced('anchor-external'));
          });
        });

        describe('given a $ref to an $anchor whose name an embedded schema resource uses too', () => {
          /**
           * An $anchor belongs to the schema resource containing it (JSON Schema Core 8.2.2), so
           * "#tag" from the root resource must select the root's $defs/Tag. apidom-reference's
           * $anchor selector (OpenAPI 3.1 and JSON Schema 2020-12 alike) searches embedded $id
           * resources too and takes the first match, the embedded one. When ApiDOM stops the
           * search at nested $ids, this test starts failing: turn it into a regular test.
           */
          test.failing('should select the $anchor of the referencing resource', async () => {
            const actual = await dereferenceFixture('anchor-embedded-resource');

            expect(toValue(actual)).toEqual(loadDereferenced('anchor-embedded-resource'));
          });
        });

        describe('given a $ref to a $dynamicAnchor', () => {
          test('should dereference it like a $ref to an $anchor', async () => {
            const actual = await dereferenceFixture('dynamic-anchor');

            expect(toValue(actual)).toEqual(loadDereferenced('dynamic-anchor'));
          });
        });

        describe('given $refs relative to an $id base URI', () => {
          test('should dereference', async () => {
            const actual = await dereferenceFixture('id-relative');

            expect(toValue(actual)).toEqual(loadDereferenced('id-relative'));
          });
        });

        describe('given a $ref to an embedded schema whose relative $id is nested in another relative $id', () => {
          /**
           * apidom-reference's `uri` selector (OpenAPI 3.1 and JSON Schema 2020-12 alike)
           * resolves the $id chain of candidate schemas against the $ref target instead of the
           * document's base URI, so this $ref stays in place. When ApiDOM fixes the selector,
           * this test starts failing: turn it into a regular test.
           */
          test.failing('should dereference', async () => {
            const actual = await dereferenceFixture('id-relative-nested');

            expect(toValue(actual)).toEqual(loadDereferenced('id-relative-nested'));
          });
        });

        describe('given $refs to canonical URIs of embedded schema resources', () => {
          test('should dereference without retrieving them', async () => {
            const actual = await dereferenceFixture('id-canonical');

            expect(toValue(actual)).toEqual(loadDereferenced('id-canonical'));
          });
        });

        describe('given $dynamicRef keywords', () => {
          test('should leave every $dynamicRef in place', async () => {
            const actual = await dereferenceFixture('dynamic-ref');
            const original = globalThis.loadJsonFile(
              path.join(rootFixturePath, 'dynamic-ref', 'root.json')
            );

            expect(toValue(actual)).toEqual(loadDereferenced('dynamic-ref'));
            expect(collect$dynamicRefs(original).sort()).toEqual([
              ['/$defs/list/items', '#items'],
              ['/$defs/sameResource/items', '#/$defs/foo'],
              ['/$defs/unmatched/items', '#unknown'],
            ]);
            // the root's $ref brings the list schema's items, its $dynamicRef unchanged
            expect(collect$dynamicRefs(toValue(actual)[0]).sort()).toEqual([
              ['/$defs/list/items', '#items'],
              ['/$defs/sameResource/items', '#/$defs/foo'],
              ['/$defs/unmatched/items', '#unknown'],
              ['/items', '#items'],
            ]);
          });
        });

        describe('given a $ref in the document root', () => {
          test('should dereference the root and the schemas within it', async () => {
            const actual = await dereferenceFixture('root-ref');

            expect(toValue(actual)).toEqual(loadDereferenced('root-ref'));
          });

          test('should keep the dereferenced root as the parse result', async () => {
            const dereferenced = await dereferenceFixture('root-ref');

            expect(isJSONSchemaElement(dereferenced.result)).toBe(true);
            expect(toValue(dereferenced.result)).toEqual(loadDereferenced('root-ref')[0]);
          });
        });

        describe('given $refs to Boolean JSON Schemas', () => {
          test('should dereference', async () => {
            const actual = await dereferenceFixture('boolean-json-schema');

            expect(toValue(actual)).toEqual(loadDereferenced('boolean-json-schema'));
          });

          test('should keep the Boolean JSON Schema semantics', async () => {
            const dereferenced = await dereferenceFixture('boolean-json-schema');

            expect(isBooleanJsonSchemaElement(evaluate('/0/properties/any', dereferenced))).toBe(
              true
            );
          });
        });

        describe('given a referencing schema with other keywords', () => {
          test('should merge them, the referencing ones winning', async () => {
            const actual = await dereferenceFixture('merging-keywords');

            expect(toValue(actual)).toEqual(loadDereferenced('merging-keywords'));
          });
        });

        describe('given an unresolvable reference', () => {
          test('should leave it in place and dereference the rest', async () => {
            const actual = await dereferenceFixture('unresolvable-reference');

            expect(toValue(actual)).toEqual(loadDereferenced('unresolvable-reference'));
          });

          test('should collect the error', async () => {
            const errors = [];
            await dereferenceFixture('unresolvable-reference', {
              dereference: { dereferenceOpts: { errors } },
            });

            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatchObject({
              message: expect.stringMatching(/^Could not resolve reference/),
              $ref: './missing.json#/$defs/User',
              fullPath: ['properties', 'user', '$ref'],
            });
          });
        });

        describe('given a JSON Pointer that evaluates to nothing', () => {
          test('should leave it in place and dereference the rest', async () => {
            const actual = await dereferenceFixture('invalid-pointer');

            expect(toValue(actual)).toEqual(loadDereferenced('invalid-pointer'));
          });

          test('should collect the error', async () => {
            const errors = [];
            await dereferenceFixture('invalid-pointer', {
              dereference: { dereferenceOpts: { errors } },
            });

            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatchObject({
              $ref: '#/$defs/Missing',
              fullPath: ['properties', 'user', '$ref'],
            });
          });
        });
      });
    });
  });
});
