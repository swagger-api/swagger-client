import { visit, toValue } from '@swagger-api/apidom-core';
import { refract, getNodeType, keyMap } from '@swagger-api/apidom-ns-json-schema-2020-12';

import ModelPropertyMacroVisitor from '../../../../../../../../src/resolver/apidom/reference/dereference/strategies/json-schema-2020-12-swagger-client/visitors/properties.js';

const $schema = 'https://json-schema.org/draft/2020-12/schema';

const applyMacro = (spec, modelPropertyMacro, errors = []) => {
  const element = refract({ $schema, ...spec });
  const visitor = new ModelPropertyMacroVisitor({
    modelPropertyMacro,
    options: { dereference: { dereferenceOpts: { errors } } },
  });
  return toValue(visit(element, visitor, { keyMap, nodeTypeGetter: getNodeType }));
};

describe('dereference', () => {
  describe('strategies', () => {
    describe('json-schema-2020-12-swagger-client', () => {
      describe('visitors', () => {
        describe('ModelPropertyMacroVisitor', () => {
          describe('given a schema without a properties keyword', () => {
            test('should leave the schema unchanged', () => {
              const macro = jest.fn(() => 'default');

              expect(applyMacro({ type: 'string' }, macro)).toEqual({ $schema, type: 'string' });
              expect(macro).not.toHaveBeenCalled();
            });
          });

          describe('given a schema with properties as a non-object value', () => {
            test('should leave the schema unchanged', () => {
              const macro = jest.fn(() => 'default');

              expect(applyMacro({ properties: [] }, macro)).toEqual({ $schema, properties: [] });
              expect(macro).not.toHaveBeenCalled();
            });
          });

          describe('given the document root and nested schemas with properties', () => {
            test('should call the macro for each property and set the default', () => {
              const macro = jest.fn((property) => `${property.type}-default`);
              const result = applyMacro(
                {
                  properties: {
                    id: { type: 'integer' },
                    user: { type: 'object', properties: { name: { type: 'string' } } },
                  },
                  $defs: { Tag: { properties: { label: { type: 'string' } } } },
                },
                macro
              );

              expect(result.properties.id.default).toBe('integer-default');
              expect(result.properties.user.default).toBe('object-default');
              expect(result.properties.user.properties.name.default).toBe('string-default');
              expect(result.$defs.Tag.properties.label.default).toBe('string-default');
              expect(macro).toHaveBeenCalledTimes(4);
            });
          });

          describe('given a schema where the macro throws an error', () => {
            test('should collect error with fullPath pointing to properties', () => {
              const errors = [];

              applyMacro(
                { $defs: { User: { properties: { id: { type: 'integer' } } } } },
                () => {
                  throw new Error('macro failed');
                },
                errors
              );

              expect(errors).toHaveLength(1);
              expect(errors[0]).toMatchObject({
                message: expect.stringMatching(/macro failed/),
                fullPath: ['$defs', 'User', 'properties'],
              });
            });

            test('should leave the property unchanged when the macro throws', () => {
              const result = applyMacro(
                { $defs: { User: { properties: { id: { type: 'integer' } } } } },
                () => {
                  throw new Error('macro failed');
                }
              );

              expect(result.$defs.User.properties.id).toEqual({ type: 'integer' });
            });
          });
        });
      });
    });
  });
});
