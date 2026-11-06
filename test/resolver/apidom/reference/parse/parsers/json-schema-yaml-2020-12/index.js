import fs from 'node:fs';
import path from 'node:path';
import YAML from 'js-yaml';
import { isParseResultElement, toValue } from '@swagger-api/apidom-core';
import { File, ParserError } from '@swagger-api/apidom-reference/configuration/empty';
import { mediaTypes, isJSONSchemaElement } from '@swagger-api/apidom-ns-json-schema-2020-12';

// eslint-disable-next-line camelcase
import JSONSchemaYAML2020_12Parser from '../../../../../../../src/resolver/apidom/reference/parse/parsers/json-schema-yaml-2020-12/index.js';

const fixturePath = path.join(__dirname, '__fixtures__', 'sample-schema.yaml');

describe('JSONSchemaYAML2020_12Parser', () => {
  test('should be named json-schema-yaml-2020-12-swagger-client', () => {
    const parser = new JSONSchemaYAML2020_12Parser();

    expect(parser.name).toBe('json-schema-yaml-2020-12-swagger-client');
  });

  describe('canParse', () => {
    describe('given file with .yaml extension', () => {
      describe('and with proper media type', () => {
        test('should return true', async () => {
          const file1 = new File({
            uri: '/path/to/schema.yaml',
            mediaType: mediaTypes.latest('generic'),
          });
          const file2 = new File({
            uri: '/path/to/schema.yaml',
            mediaType: mediaTypes.latest('yaml'),
          });
          const parser = new JSONSchemaYAML2020_12Parser();

          expect(await parser.canParse(file1)).toBe(true);
          expect(await parser.canParse(file2)).toBe(true);
        });
      });

      describe('and with JSON media type', () => {
        test('should return false', async () => {
          const file = new File({
            uri: '/path/to/schema.yaml',
            mediaType: mediaTypes.latest('json'),
          });
          const parser = new JSONSchemaYAML2020_12Parser();

          expect(await parser.canParse(file)).toBe(false);
        });
      });
    });

    describe('given file with unknown extension', () => {
      test('should return false', async () => {
        const file = new File({
          uri: '/path/to/schema.json',
          mediaType: mediaTypes.latest('yaml'),
        });
        const parser = new JSONSchemaYAML2020_12Parser({ fileExtensions: ['.yaml'] });

        expect(await parser.canParse(file)).toBe(false);
      });
    });

    describe('given file with supported extension', () => {
      describe('and file data is buffer and can be detected as JSON Schema 2020-12', () => {
        test('should return true', async () => {
          const file = new File({
            uri: '/path/to/schema.yaml',
            data: fs.readFileSync(fixturePath),
          });
          const parser = new JSONSchemaYAML2020_12Parser();

          expect(await parser.canParse(file)).toBe(true);
        });
      });

      describe('and file data is JSON that can be detected as JSON Schema 2020-12', () => {
        test('should return true', async () => {
          const file = new File({
            uri: '/path/to/schema.yaml',
            data: '{"$schema": "https://json-schema.org/draft/2020-12/schema"}',
          });
          const parser = new JSONSchemaYAML2020_12Parser();

          expect(await parser.canParse(file)).toBe(true);
        });
      });

      describe('and $schema is only in a nested schema', () => {
        test('should return false', async () => {
          const file = new File({
            uri: '/path/to/schema.yaml',
            data: 'type: object\nproperties:\n  a:\n    $schema: https://json-schema.org/draft/2020-12/schema\n',
          });
          const parser = new JSONSchemaYAML2020_12Parser();

          expect(await parser.canParse(file)).toBe(false);
        });
      });

      describe('and $schema uses the http scheme', () => {
        test('should return false', async () => {
          const file = new File({
            uri: '/path/to/schema.yaml',
            data: '$schema: http://json-schema.org/draft/2020-12/schema\n',
          });
          const parser = new JSONSchemaYAML2020_12Parser();

          expect(await parser.canParse(file)).toBe(false);
        });
      });

      describe('and the document is an OpenAPI document with root $schema', () => {
        test('should return false', async () => {
          const file = new File({
            uri: '/path/to/openapi.yaml',
            data: 'openapi: 3.1.0\n$schema: https://json-schema.org/draft/2020-12/schema\n',
          });
          const parser = new JSONSchemaYAML2020_12Parser();

          expect(await parser.canParse(file)).toBe(false);
        });
      });

      describe('and file data is not YAML', () => {
        test('should return false', async () => {
          const file = new File({
            uri: '/path/to/schema.yaml',
            data: '$schema: [',
          });
          const parser = new JSONSchemaYAML2020_12Parser();

          expect(await parser.canParse(file)).toBe(false);
        });
      });
    });
  });

  describe('parse', () => {
    describe('given JSON Schema 2020-12 YAML data', () => {
      test('should return parse result with a JSON Schema 2020-12 element', async () => {
        const data = fs.readFileSync(fixturePath).toString();
        const file = new File({
          uri: fixturePath,
          data,
          mediaType: mediaTypes.latest('yaml'),
        });
        const parser = new JSONSchemaYAML2020_12Parser();
        const parseResult = await parser.parse(file);

        expect(isParseResultElement(parseResult)).toBe(true);
        expect(isJSONSchemaElement(parseResult.result)).toBe(true);
        expect(parseResult.result.element).toBe('JSONSchema202012');
        expect(isJSONSchemaElement(parseResult.result.get('$defs').get('Address'))).toBe(true);
        expect(toValue(parseResult.result)).toEqual(YAML.load(data));
      });
    });

    describe('given JSON Schema 2020-12 YAML data as buffer', () => {
      test('should return parse result', async () => {
        const file = new File({
          uri: fixturePath,
          data: fs.readFileSync(fixturePath),
          mediaType: mediaTypes.latest('yaml'),
        });
        const parser = new JSONSchemaYAML2020_12Parser();
        const parseResult = await parser.parse(file);

        expect(isParseResultElement(parseResult)).toBe(true);
        expect(isJSONSchemaElement(parseResult.result)).toBe(true);
      });
    });

    describe('given empty file', () => {
      test('should return empty parse result', async () => {
        const file = new File({
          uri: '/path/to/schema.yaml',
          data: '',
          mediaType: mediaTypes.latest('yaml'),
        });
        const parser = new JSONSchemaYAML2020_12Parser();
        const parseResult = await parser.parse(file);

        expect(isParseResultElement(parseResult)).toBe(true);
        expect(parseResult.isEmpty).toBe(true);
      });
    });

    describe('given invalid YAML', () => {
      test('should throw ParserError', async () => {
        const file = new File({
          uri: '/path/to/schema.yaml',
          data: '$schema: [',
          mediaType: mediaTypes.latest('yaml'),
        });
        const parser = new JSONSchemaYAML2020_12Parser();

        await expect(parser.parse(file)).rejects.toThrow(ParserError);
      });
    });

    describe('sourceMap', () => {
      describe('given sourceMap enabled', () => {
        test('should throw error', async () => {
          const file = new File({ uri: '/path/to/schema.yaml', data: 'prop: val' });
          const parser = new JSONSchemaYAML2020_12Parser({ sourceMap: true });
          const parseWithSourceMapThunk = () => parser.parse(file);

          await expect(parseWithSourceMapThunk()).rejects.toThrow(
            new ParserError(
              "json-schema-yaml-2020-12-swagger-client parser plugin doesn't support sourceMaps option"
            )
          );
        });
      });

      describe('given sourceMap disabled', () => {
        test('should not decorate ApiDOM with source maps', async () => {
          const file = new File({
            uri: fixturePath,
            data: fs.readFileSync(fixturePath).toString(),
            mediaType: mediaTypes.latest('yaml'),
          });
          const parser = new JSONSchemaYAML2020_12Parser();
          const parseResult = await parser.parse(file);

          expect(parseResult.result.meta.get('sourceMap')).toBeUndefined();
        });
      });
    });
  });
});
