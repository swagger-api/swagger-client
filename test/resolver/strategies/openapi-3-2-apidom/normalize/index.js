import path from 'node:path';
/* eslint-disable camelcase */
import { toValue, StringElement } from '@swagger-api/apidom-core';
import { OpenApi3_2Element } from '@swagger-api/apidom-ns-openapi-3-2';

import normalize, {
  pojoAdapter,
} from '../../../../../src/resolver/strategies/openapi-3-2-apidom/normalize.js';
import resolveOpenAPI32Strategy from '../../../../../src/resolver/strategies/openapi-3-2-apidom/resolve.js';

const fixturesPath = path.join(__dirname, '__fixtures__');

/**
 * This test suite only guarantees that normalization works for OpenAPI 3.2.0.
 * Complete coverage of all use-cases including corner-cases are covered
 * upstream in ApiDOM.
 */

describe('helpers', () => {
  describe('normalize', () => {
    describe('OpenAPI 3.2', () => {
      describe('given denormalized Header Object examples', () => {
        test('should normalize', () => {
          const spec = globalThis.loadJsonFile(path.join(fixturesPath, 'header-examples.json'));
          const openApiElement = OpenApi3_2Element.refract(spec);
          const normalized = normalize(openApiElement);

          expect(toValue(normalized)).toMatchSnapshot();
        });
      });

      describe('given denormalized Parameter Object examples', () => {
        test('should normalize', () => {
          const spec = globalThis.loadJsonFile(path.join(fixturesPath, 'parameter-examples.json'));
          const openApiElement = OpenApi3_2Element.refract(spec);
          const normalized = normalize(openApiElement);

          expect(toValue(normalized)).toMatchSnapshot();
        });
      });

      describe('given denormalized Operation.id fields', () => {
        test('should normalize', () => {
          const spec = globalThis.loadJsonFile(path.join(fixturesPath, 'operation-ids.json'));
          const openApiElement = OpenApi3_2Element.refract(spec);
          const normalized = normalize(openApiElement);

          expect(toValue(normalized)).toMatchSnapshot();
        });
      });

      describe('given denormalized Parameter Objects', () => {
        test('should normalize', () => {
          const spec = globalThis.loadJsonFile(path.join(fixturesPath, 'parameters.json'));
          const openApiElement = OpenApi3_2Element.refract(spec);
          const normalized = normalize(openApiElement);

          expect(toValue(normalized)).toMatchSnapshot();
        });
      });

      describe('given denormalized Security Requirements Objects', () => {
        test('should normalize', () => {
          const spec = globalThis.loadJsonFile(
            path.join(fixturesPath, 'security-requirements.json')
          );
          const openApiElement = OpenApi3_2Element.refract(spec);
          const normalized = normalize(openApiElement);

          expect(toValue(normalized)).toMatchSnapshot();
        });
      });

      describe('given denormalized Servers Objects', () => {
        test('should normalize', () => {
          const spec = globalThis.loadJsonFile(path.join(fixturesPath, 'servers.json'));
          const openApiElement = OpenApi3_2Element.refract(spec);
          const normalized = normalize(openApiElement);

          expect(toValue(normalized)).toMatchSnapshot();
        });
      });

      describe('given element non compatible with ObjectElement', () => {
        test('should skip normalization', () => {
          const element = new StringElement('test');
          const normalized = normalize(element);

          expect(normalized).toEqual(element);
        });
      });

      describe('given spec is already normalized', () => {
        test('should skip normalization', () => {
          const spec = globalThis.loadJsonFile(path.join(fixturesPath, 'servers.json'));
          const openApiElement = OpenApi3_2Element.refract(spec);
          const normalized = normalize(openApiElement);
          const doubleNormalized = normalize(normalized);

          expect(normalized).toEqual(doubleNormalized);
        });
      });
    });
  });

  describe('pojoAdapter', () => {
    test('should returned cached normalized POJO', () => {
      const spec = globalThis.loadJsonFile(path.join(fixturesPath, 'parameters.json'));
      const openApiElement = OpenApi3_2Element.refract(spec);
      const normalized1 = pojoAdapter(normalize)(openApiElement);
      const normalized2 = toValue(pojoAdapter(normalize)(openApiElement));

      expect(normalized1).toEqual(normalized2);
    });

    test('should return the same POJO for the same input', () => {
      const spec = globalThis.loadJsonFile(path.join(fixturesPath, 'parameters.json'));
      const normalized1 = pojoAdapter(normalize)(spec);
      const normalized2 = pojoAdapter(normalize)(spec);

      expect(normalized1).toBe(normalized2);
    });

    test('should cache the refracted element under the returned POJO', () => {
      const spec = globalThis.loadJsonFile(path.join(fixturesPath, 'parameters.json'));
      const normalized = pojoAdapter(normalize)(spec);

      expect(resolveOpenAPI32Strategy.cache.has(normalized)).toBe(true);
    });
  });
});
/* eslint-enable camelcase */
