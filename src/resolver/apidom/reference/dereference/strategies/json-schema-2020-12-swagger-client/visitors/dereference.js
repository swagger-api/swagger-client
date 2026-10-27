/* eslint-disable camelcase */
import {
  RefElement,
  isStringElement,
  isMemberElement,
  IdentityManager,
  visit,
  toValue,
  cloneDeep,
} from '@swagger-api/apidom-core';
import { ApiDOMError } from '@swagger-api/apidom-error';
import {
  isJSONSchemaElement,
  isBooleanJsonSchemaElement,
  JSONSchemaElement,
  getNodeType,
  keyMap,
} from '@swagger-api/apidom-ns-json-schema-2020-12';
import {
  evaluate as jsonPointerEvaluate,
  URIFragmentIdentifier,
} from '@swagger-api/apidom-json-pointer/modern';
import {
  url,
  MaximumDereferenceDepthError,
  File,
} from '@swagger-api/apidom-reference/configuration/empty';
import {
  JSONSchema2020_12DereferenceVisitor,
  resolveSchema$refField,
  maybeRefractToSchemaElement,
} from '@swagger-api/apidom-reference/dereference/strategies/json-schema-2020-12';
import {
  isAnchor,
  uriToAnchor,
  evaluate as $anchorEvaluate,
} from '@swagger-api/apidom-reference/dereference/strategies/json-schema-2020-12/selectors/$anchor';
import {
  evaluate as uriEvaluate,
  EvaluationJsonSchemaUriError,
} from '@swagger-api/apidom-reference/dereference/strategies/json-schema-2020-12/selectors/uri';

import toPath from '../utils/to-path.js';
import getRootCause from '../utils/get-root-cause.js';
import SchemaRefError from '../errors/SchemaRefError.js';

const visitAsync = visit[Symbol.for('nodejs.util.promisify.custom')];

// initialize element identity manager
const identityManager = new IdentityManager();

// custom mutation replacer
const mutationReplacer = (newElement, oldElement, key, parent) => {
  if (isMemberElement(parent)) {
    parent.value = newElement; // eslint-disable-line no-param-reassign
  } else if (Array.isArray(parent)) {
    parent[key] = newElement; // eslint-disable-line no-param-reassign
  }
};

/**
 * Dereferences the $ref keyword of JSON Schema 2020-12 schemas the way the OpenAPI 3.1
 * swagger-client visitor dereferences Schema Objects: $ref resolves against $id base URIs and
 * $anchor (or $dynamicAnchor) plain name fragments. $dynamicRef is left in place.
 */
class JSONSchema2020_12SwaggerClientDereferenceVisitor extends JSONSchema2020_12DereferenceVisitor {
  useCircularStructures;

  allowMetaPatches;

  basePath;

  constructor({
    allowMetaPatches = true,
    useCircularStructures = false,
    basePath = null,
    ...rest
  }) {
    super(rest);

    this.allowMetaPatches = allowMetaPatches;
    this.useCircularStructures = useCircularStructures;
    this.basePath = basePath;
  }

  async JSONSchema202012Element(referencingElement, key, parent, path, ancestors, link) {
    try {
      // skip current referencing schema as $ref keyword was not defined
      if (!isStringElement(referencingElement.$ref)) {
        // skip traversing this schema but traverse all it's child schemas
        return undefined;
      }

      // skip current referencing element as it's already been access
      if (this.indirections.includes(referencingElement)) {
        return false;
      }

      const [ancestorsLineage, directAncestors] = this.toAncestorLineage([...ancestors, parent]);

      // compute baseURI using rules around $id and $ref keywords
      let reference = await this.toReference(url.unsanitize(this.reference.uri));
      let { uri: retrievalURI } = reference;
      const $refBaseURI = resolveSchema$refField(retrievalURI, referencingElement);
      const $refBaseURIStrippedHash = url.stripHash($refBaseURI);
      const file = new File({ uri: $refBaseURIStrippedHash });
      const isUnknownURI = !this.options.resolve.resolvers.some((r) => r.canRead(file));
      const isURL = !isUnknownURI;
      let isInternalReference = url.stripHash(this.reference.uri) === $refBaseURI;
      let isExternalReference = !isInternalReference;

      this.indirections.push(referencingElement);

      // determining reference, proper evaluation and selection mechanism
      let referencedElement;

      try {
        if (isUnknownURI || isURL) {
          // we're dealing with canonical URI or URL with possible fragment
          retrievalURI = this.toBaseURI($refBaseURI);
          const selector = $refBaseURI;
          const referenceAsSchema = maybeRefractToSchemaElement(reference.value.result);
          referencedElement = uriEvaluate(selector, referenceAsSchema);
          referencedElement = maybeRefractToSchemaElement(referencedElement);
          referencedElement.id = identityManager.identify(referencedElement);

          // ignore resolving internal schemas
          if (!this.options.resolve.internal && isInternalReference) {
            // skip traversing this schema element but traverse all it's child elements
            return undefined;
          }
          // ignore resolving external schemas
          if (!this.options.resolve.external && isExternalReference) {
            // skip traversing this schema element but traverse all it's child elements
            return undefined;
          }
        } else {
          // we're assuming here that we're dealing with JSON Pointer here
          retrievalURI = this.toBaseURI($refBaseURI);
          isInternalReference = url.stripHash(this.reference.uri) === retrievalURI;
          isExternalReference = !isInternalReference;

          // ignore resolving internal schemas
          if (!this.options.resolve.internal && isInternalReference) {
            // skip traversing this schema element but traverse all it's child elements
            return undefined;
          }
          // ignore resolving external schemas
          if (!this.options.resolve.external && isExternalReference) {
            // skip traversing this schema element but traverse all it's child elements
            return undefined;
          }

          reference = await this.toReference(url.unsanitize($refBaseURI));
          const selector = URIFragmentIdentifier.fromURIReference($refBaseURI);
          const referenceAsSchema = maybeRefractToSchemaElement(reference.value.result);
          referencedElement = jsonPointerEvaluate(referenceAsSchema, selector);
          referencedElement = maybeRefractToSchemaElement(referencedElement);
          referencedElement.id = identityManager.identify(referencedElement);
        }
      } catch (error) {
        /**
         * No schema with $id=URL was found, so we're going to try to resolve
         * the URL and assume the returned response is a JSON Schema.
         */
        if (isURL && error instanceof EvaluationJsonSchemaUriError) {
          if (isAnchor(uriToAnchor($refBaseURI))) {
            // we're dealing with JSON Schema $anchor (or $dynamicAnchor) here
            isInternalReference = url.stripHash(this.reference.uri) === retrievalURI;
            isExternalReference = !isInternalReference;

            // ignore resolving internal schemas
            if (!this.options.resolve.internal && isInternalReference) {
              // skip traversing this schema element but traverse all it's child elements
              return undefined;
            }
            // ignore resolving external schemas
            if (!this.options.resolve.external && isExternalReference) {
              // skip traversing this schema element but traverse all it's child elements
              return undefined;
            }

            reference = await this.toReference(url.unsanitize($refBaseURI));
            const selector = uriToAnchor($refBaseURI);
            const referenceAsSchema = maybeRefractToSchemaElement(reference.value.result);
            referencedElement = $anchorEvaluate(selector, referenceAsSchema);
            referencedElement = maybeRefractToSchemaElement(referencedElement);
            referencedElement.id = identityManager.identify(referencedElement);
          } else {
            // we're assuming here that we're dealing with JSON Pointer here
            retrievalURI = this.toBaseURI(toValue($refBaseURI));
            isInternalReference = url.stripHash(this.reference.uri) === retrievalURI;
            isExternalReference = !isInternalReference;

            // ignore resolving internal schemas
            if (!this.options.resolve.internal && isInternalReference) {
              // skip traversing this schema element but traverse all it's child elements
              return undefined;
            }
            // ignore resolving external schemas
            if (!this.options.resolve.external && isExternalReference) {
              // skip traversing this schema element but traverse all it's child elements
              return undefined;
            }

            reference = await this.toReference(url.unsanitize($refBaseURI));
            const selector = URIFragmentIdentifier.fromURIReference($refBaseURI);
            const referenceAsSchema = maybeRefractToSchemaElement(reference.value.result);
            referencedElement = jsonPointerEvaluate(referenceAsSchema, selector);
            referencedElement = maybeRefractToSchemaElement(referencedElement);
            referencedElement.id = identityManager.identify(referencedElement);
          }
        } else {
          throw error;
        }
      }

      // detect direct or indirect reference
      if (referencingElement === referencedElement) {
        throw new ApiDOMError('Recursive JSON Schema reference detected');
      }

      // detect maximum depth of dereferencing
      if (this.indirections.length > this.options.dereference.maxDepth) {
        throw new MaximumDereferenceDepthError(
          `Maximum dereference depth of "${this.options.dereference.maxDepth}" has been exceeded in file "${this.reference.uri}"`
        );
      }

      // detect second deep dive into the same fragment and avoid it
      if (ancestorsLineage.includes(referencedElement)) {
        reference.refSet.circular = true;

        if (this.options.dereference.circular === 'error') {
          throw new ApiDOMError('Circular reference detected');
        } else if (this.options.dereference.circular === 'replace') {
          const refElement = new RefElement(referencedElement.id, {
            type: 'json-schema',
            uri: reference.uri,
            $ref: toValue(referencingElement.$ref),
            baseURI: url.resolve(retrievalURI, $refBaseURI),
            referencingElement,
          });
          const replacer =
            this.options.dereference.strategyOpts['json-schema-2020-12']?.circularReplacer ??
            this.options.dereference.circularReplacer;
          const replacement = replacer(refElement);

          link.replaceWith(replacement, mutationReplacer);

          return !parent ? replacement : false;
        }
      }

      /**
       * Dive deep into the fragment.
       *
       * Cases to consider:
       *  1. We're crossing document boundary
       *  2. Fragment is from non-root document
       *  3. Fragment is a schema with $ref keyword. We need to follow it to get the eventual value
       *  4. We are dereferencing the fragment lazily/eagerly depending on circular mode
       */
      const isNonRootDocument = url.stripHash(reference.refSet.rootRef.uri) !== reference.uri;
      const shouldDetectCircular = ['error', 'replace'].includes(this.options.dereference.circular);
      if (
        (isExternalReference ||
          isNonRootDocument ||
          (isJSONSchemaElement(referencedElement) && isStringElement(referencedElement.$ref)) ||
          shouldDetectCircular) &&
        !ancestorsLineage.includesCycle(referencedElement)
      ) {
        // append referencing schema to ancestors lineage
        directAncestors.add(referencingElement);

        // dive deep into the fragment
        const mergeVisitor = new JSONSchema2020_12SwaggerClientDereferenceVisitor({
          reference,
          namespace: this.namespace,
          indirections: [...this.indirections],
          options: this.options,
          refractCache: this.refractCache,
          useCircularStructures: this.useCircularStructures,
          allowMetaPatches: this.allowMetaPatches,
          ancestors: ancestorsLineage,
          basePath: this.basePath ?? [
            ...toPath([...ancestors, parent, referencingElement]),
            '$ref',
          ],
        });
        referencedElement = await visitAsync(referencedElement, mergeVisitor, {
          keyMap,
          nodeTypeGetter: getNodeType,
        });

        // remove referencing schema from ancestors lineage
        directAncestors.delete(referencingElement);
      }

      this.indirections.pop();

      /**
       * The document root is a schema: when it is the referencing schema, its replacement
       * must stay the result of the parse result, as later references into the document
       * are evaluated against it.
       */
      const isParseResultRoot = referencingElement.classes.includes('result');

      if (isBooleanJsonSchemaElement(referencedElement)) {
        const booleanJsonSchemaElement = cloneDeep(referencedElement);
        if (isParseResultRoot && !booleanJsonSchemaElement.classes.includes('result')) {
          booleanJsonSchemaElement.classes.push('result');
        }
        // annotate referenced element with info about original referencing element
        booleanJsonSchemaElement.setMetaProperty('ref-fields', {
          $ref: toValue(referencingElement.$ref),
        });
        // annotate referenced element with info about origin
        booleanJsonSchemaElement.setMetaProperty('ref-origin', reference.uri);
        // annotate fragment with info about referencing element
        booleanJsonSchemaElement.setMetaProperty(
          'ref-referencing-element-id',
          cloneDeep(identityManager.identify(referencingElement))
        );

        link.replaceWith(booleanJsonSchemaElement, mutationReplacer);

        return !parent ? booleanJsonSchemaElement : false;
      }

      /**
       * Creating a new version of the schema by merging keywords from the referenced schema with the referencing one.
       */
      if (isJSONSchemaElement(referencedElement)) {
        // merge keywords from referenced schema with referencing schema
        const mergedElement = new JSONSchemaElement(
          [...referencedElement.content],
          cloneDeep(referencedElement.meta),
          cloneDeep(referencedElement.attributes)
        );
        // existing keywords from referencing schema overrides ones from referenced schema
        referencingElement.forEach((value, keyElement, item) => {
          mergedElement.remove(toValue(keyElement));
          mergedElement.content.push(item);
        });
        mergedElement.remove('$ref');
        if (isParseResultRoot && !mergedElement.classes.includes('result')) {
          mergedElement.classes.push('result');
        }
        // annotate referenced element with info about original referencing element
        mergedElement.setMetaProperty('ref-fields', {
          $ref: toValue(referencingElement.$ref),
        });
        // annotate fragment with info about origin
        mergedElement.setMetaProperty('ref-origin', reference.uri);
        // annotate fragment with info about referencing element
        mergedElement.setMetaProperty(
          'ref-referencing-element-id',
          cloneDeep(identityManager.identify(referencingElement))
        );

        // allowMetaPatches option processing
        if (this.allowMetaPatches) {
          // apply meta patch only when not already applied
          if (typeof mergedElement.get('$$ref') === 'undefined') {
            const baseURI = url.resolve(retrievalURI, $refBaseURI);
            mergedElement.set('$$ref', baseURI);
          }
        }

        referencedElement = mergedElement;
      }

      /**
       * Transclude referencing element with merged referenced element.
       */
      link.replaceWith(referencedElement, mutationReplacer);

      /**
       * We're at the root of the tree, so we're just replacing the entire tree.
       */
      return !parent ? referencedElement : undefined;
    } catch (error) {
      const rootCause = getRootCause(error);
      const wrappedError = new SchemaRefError(`Could not resolve reference: ${rootCause.message}`, {
        baseDoc: this.reference.uri,
        $ref: toValue(referencingElement.$ref),
        fullPath: this.basePath ?? [...toPath([...ancestors, parent, referencingElement]), '$ref'],
        cause: rootCause,
      });
      this.options.dereference.dereferenceOpts?.errors?.push?.(wrappedError);

      return undefined;
    }
  }
}

export default JSONSchema2020_12SwaggerClientDereferenceVisitor;
/* eslint-enable camelcase */
