/* eslint-disable camelcase */
import {
  ParseResultElement,
  ObjectElement,
  toValue,
  transclude,
  cloneDeep,
} from '@swagger-api/apidom-core';
import {
  compile as jsonPointerCompile,
  evaluate as jsonPointerEvaluate,
  JSONPointerEvaluateError,
} from '@swagger-api/apidom-json-pointer/modern';
import { mediaTypes, refract } from '@swagger-api/apidom-ns-json-schema-2020-12';
import {
  dereferenceApiDOM,
  url,
  ReferenceSet,
  Reference,
  options as referenceOptions,
} from '@swagger-api/apidom-reference/configuration/empty';
import BinaryParser from '@swagger-api/apidom-reference/parse/parsers/binary';
import JSONSchema2020_12ResolveStrategy from '@swagger-api/apidom-reference/resolve/strategies/json-schema-2020-12';

import { DEFAULT_BASE_URL } from '../../../constants.js';
import * as optionsUtil from '../../utils/options.js';
import normalize from './normalize.js';
import HTTPResolverSwaggerClient from '../../apidom/reference/resolve/resolvers/http-swagger-client/index.js';
import JSONParser from '../../apidom/reference/parse/parsers/json/index.js';
import YAMLParser from '../../apidom/reference/parse/parsers/yaml-1-2/index.js';
import JSONSchemaJSON2020_12Parser from '../../apidom/reference/parse/parsers/json-schema-json-2020-12/index.js';
import JSONSchemaYAML2020_12Parser from '../../apidom/reference/parse/parsers/json-schema-yaml-2020-12/index.js';
import JSONSchema2020_12SwaggerClientDereferenceStrategy from '../../apidom/reference/dereference/strategies/json-schema-2020-12-swagger-client/index.js';

export const circularReplacer = (refElement) => {
  const $refBaseURI = toValue(refElement.meta.get('baseURI'));
  const referencingElement = refElement.meta.get('referencingElement');

  /**
   * Removing semantics from the absolutified referencing element by
   * using generic ObjectElement to represent the reference.
   */
  return new ObjectElement(
    { $ref: $refBaseURI },
    cloneDeep(referencingElement.meta),
    cloneDeep(referencingElement.attributes)
  );
};

const resolveJSONSchema202012Strategy = async (options) => {
  const {
    spec,
    timeout,
    redirects,
    requestInterceptor,
    responseInterceptor,
    pathDiscriminator = [],
    allowMetaPatches = false,
    useCircularStructures = false,
    skipNormalization = false,
    modelPropertyMacro = null,
    mode = 'non-strict',
  } = options;
  try {
    const { cache } = resolveJSONSchema202012Strategy;

    // determining BaseURI
    const cwd = url.isHttpUrl(url.cwd()) ? url.cwd() : DEFAULT_BASE_URL;
    const retrievalURI = optionsUtil.retrievalURI(options);
    const baseURI = url.resolve(cwd, retrievalURI);

    // prepare spec for dereferencing
    let jsonSchemaElement;
    if (cache.has(spec)) {
      jsonSchemaElement = cache.get(spec);
    } else {
      /**
       * The namespace refractor is used instead of `JSONSchemaElement.refract`:
       * other namespaces building on JSON Schema 2020-12 (Arazzo) reassign that static method.
       */
      jsonSchemaElement = refract(spec);
      jsonSchemaElement.classes.push('result');
      cache.set(spec, jsonSchemaElement);
    }

    const jsonSchemaParseResultElement = new ParseResultElement([jsonSchemaElement]);

    // prepare fragment for dereferencing
    const jsonPointer = jsonPointerCompile(pathDiscriminator);
    const jsonPointerURI = jsonPointer === '' ? '' : `#${jsonPointer}`;
    const fragmentElement = jsonPointerEvaluate(jsonSchemaElement, jsonPointer);

    // prepare reference set for dereferencing
    const jsonSchemaElementReference = new Reference({
      uri: baseURI,
      value: jsonSchemaParseResultElement,
    });
    const refSet = new ReferenceSet({ refs: [jsonSchemaElementReference] });
    if (jsonPointer !== '') refSet.rootRef = undefined; // reset root reference as we want fragment to become the root reference

    /**
     * Prepare ancestors; needed for cases where fragment is not the document root.
     * The lineage holds the root and every element along the pathDiscriminator, so a $ref
     * from within the fragment to one of its ancestors (`"$ref": "#"` in a recursive schema)
     * is detected as a cycle instead of being expanded without end.
     */
    const pathElements = [jsonSchemaElement];
    pathDiscriminator.reduce((parentElement, token) => {
      const element = jsonPointerEvaluate(parentElement, jsonPointerCompile([token]));
      pathElements.push(element);
      return element;
    }, jsonSchemaElement);
    const ancestors = [new Set(pathElements)];

    const errors = [];
    const dereferenced = await dereferenceApiDOM(fragmentElement, {
      resolve: {
        /**
         * swagger-client only supports resolving HTTP(S) URLs or spec objects.
         * If runtime env is detected as non-browser one,
         * and baseURI was not provided as part of resolver options,
         * then below baseURI check will make sure that constant HTTPS URL is used as baseURI.
         */
        baseURI: `${baseURI}${jsonPointerURI}`,
        resolvers: [
          new HTTPResolverSwaggerClient({
            timeout: timeout || 10000,
            redirects: redirects || 10,
          }),
        ],
        resolverOpts: {
          swaggerHTTPClientConfig: {
            requestInterceptor,
            responseInterceptor,
          },
        },
        strategies: [new JSONSchema2020_12ResolveStrategy()],
      },
      parse: {
        mediaType: mediaTypes.latest(),
        /**
         * The JSON Schema 2020-12 parsers detect documents by their root $schema. They belong
         * only to this strategy: parser lists used by the OpenAPI strategies must not contain
         * them, or external files of OpenAPI documents that declare a root $schema would be
         * refracted as JSON Schema documents.
         */
        parsers: [
          new JSONSchemaJSON2020_12Parser({ allowEmpty: false, sourceMap: false }),
          new JSONSchemaYAML2020_12Parser({ allowEmpty: false, sourceMap: false }),
          new JSONParser({ allowEmpty: false, sourceMap: false }),
          new YAMLParser({ allowEmpty: false, sourceMap: false }),
          new BinaryParser({ allowEmpty: false, sourceMap: false }),
        ],
      },
      dereference: {
        maxDepth: 100,
        strategies: [
          new JSONSchema2020_12SwaggerClientDereferenceStrategy({
            allowMetaPatches,
            useCircularStructures,
            modelPropertyMacro,
            mode,
            ancestors,
          }),
        ],
        refSet,
        dereferenceOpts: { errors },
        immutable: false,
        circular: useCircularStructures ? 'ignore' : 'replace',
        circularReplacer: useCircularStructures
          ? referenceOptions.dereference.circularReplacer
          : circularReplacer,
      },
    });
    const transcluded = transclude(fragmentElement, dereferenced, jsonSchemaElement);
    const normalized = skipNormalization ? transcluded : normalize(transcluded);

    return { spec: toValue(normalized), errors };
  } catch (error) {
    if (error instanceof JSONPointerEvaluateError) {
      return { spec, errors: [] };
    }
    throw error;
  }
};
resolveJSONSchema202012Strategy.cache = new WeakMap();

export default resolveJSONSchema202012Strategy;
/* eslint-enable camelcase */
