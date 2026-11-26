/* eslint-disable camelcase */
import {
  RefElement,
  isObjectElement,
  isPrimitiveElement,
  isStringElement,
  isMemberElement,
  IdentityManager,
  visit,
  includesClasses,
  toValue,
  cloneShallow,
  cloneDeep,
} from '@swagger-api/apidom-core';
import { ApiDOMError } from '@swagger-api/apidom-error';
import {
  isReferenceLikeElement,
  isReferenceElement,
  isBooleanJsonSchemaElement,
  isPathItemElement,
  isSchemaElement,
  ReferenceElement,
  PathItemElement,
  SchemaElement,
  getNodeType,
  keyMap,
} from '@swagger-api/apidom-ns-openapi-3-1';
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
  OpenAPI3_1DereferenceVisitor,
  resolveSchema$refField,
  maybeRefractToSchemaElement,
} from '@swagger-api/apidom-reference/dereference/strategies/openapi-3-1';
import {
  isAnchor,
  uriToAnchor,
  evaluate as $anchorEvaluate,
} from '@swagger-api/apidom-reference/dereference/strategies/openapi-3-1/selectors/$anchor';
import {
  evaluate as uriEvaluate,
  EvaluationJsonSchemaUriError,
} from '@swagger-api/apidom-reference/dereference/strategies/openapi-3-1/selectors/uri';

import toPath from '../utils/to-path.js';
import getRootCause from '../utils/get-root-cause.js';
import specMapMod from '../../../../../../specmap/lib/refs.js';
import SchemaRefError from '../errors/SchemaRefError.js';

const { wrapError } = specMapMod;

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

class OpenAPI3_1SwaggerClientDereferenceVisitor extends OpenAPI3_1DereferenceVisitor {
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

  async ReferenceElement(referencingElement, key, parent, path, ancestors, link) {
    try {
      // skip current referencing element as it's already been access
      if (this.indirections.includes(referencingElement)) {
        return false;
      }

      const [ancestorsLineage, directAncestors] = this.toAncestorLineage([...ancestors, parent]);

      const retrievalURI = this.toBaseURI(toValue(referencingElement.$ref));
      const isInternalReference = url.stripHash(this.reference.uri) === retrievalURI;
      const isExternalReference = !isInternalReference;

      // ignore resolving internal Reference Objects
      if (!this.options.resolve.internal && isInternalReference) {
        return false;
      }
      // ignore resolving external Reference Objects
      if (!this.options.resolve.external && isExternalReference) {
        return false;
      }

      const reference = await this.toReference(toValue(referencingElement.$ref));
      const $refBaseURI = url.resolve(retrievalURI, toValue(referencingElement.$ref));

      this.indirections.push(referencingElement);

      const jsonPointer = URIFragmentIdentifier.fromURIReference($refBaseURI);

      // possibly non-semantic fragment
      let referencedElement = jsonPointerEvaluate(reference.value.result, jsonPointer);
      referencedElement.id = identityManager.identify(referencedElement);

      // applying semantics to a fragment
      if (isPrimitiveElement(referencedElement)) {
        const referencedElementType = toValue(referencingElement.meta.get('referenced-element'));
        const cacheKey = `${referencedElementType}-${toValue(identityManager.identify(referencedElement))}`;

        if (this.refractCache.has(cacheKey)) {
          referencedElement = this.refractCache.get(cacheKey);
        } else if (isReferenceLikeElement(referencedElement)) {
          // handling indirect references
          referencedElement = ReferenceElement.refract(referencedElement);
          referencedElement.setMetaProperty('referenced-element', referencedElementType);
          this.refractCache.set(cacheKey, referencedElement);
        } else {
          // handling direct references
          const ElementClass = this.namespace.getElementClass(referencedElementType);
          referencedElement = ElementClass.refract(referencedElement);
          this.refractCache.set(cacheKey, referencedElement);
        }
      }

      // detect direct or indirect reference
      if (referencingElement === referencedElement) {
        throw new ApiDOMError('Recursive Reference Object detected');
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
            type: 'reference',
            uri: reference.uri,
            $ref: toValue(referencingElement.$ref),
            baseURI: $refBaseURI,
            referencingElement,
          });
          const replacer =
            this.options.dereference.strategyOpts['openapi-3-1']?.circularReplacer ??
            this.options.dereference.circularReplacer;
          const replacement = replacer(refElement);

          link.replaceWith(refElement, mutationReplacer);

          return !parent ? replacement : false;
        }
      }

      /**
       * Dive deep into the fragment.
       *
       * Cases to consider:
       *  1. We're crossing document boundary
       *  2. Fragment is from non-root document
       *  3. Fragment is a Reference Object. We need to follow it to get the eventual value
       *  4. We are dereferencing the fragment lazily/eagerly depending on circular mode
       */
      const isNonRootDocument = url.stripHash(reference.refSet.rootRef.uri) !== reference.uri;
      const shouldDetectCircular = ['error', 'replace'].includes(this.options.dereference.circular);
      if (
        (isExternalReference ||
          isNonRootDocument ||
          isReferenceElement(referencedElement) ||
          shouldDetectCircular) &&
        !ancestorsLineage.includesCycle(referencedElement)
      ) {
        // append referencing reference to ancestors lineage
        directAncestors.add(referencingElement);

        const visitor = new OpenAPI3_1SwaggerClientDereferenceVisitor({
          reference,
          namespace: this.namespace,
          indirections: [...this.indirections],
          options: this.options,
          refractCache: this.refractCache,
          ancestors: ancestorsLineage,
          allowMetaPatches: this.allowMetaPatches,
          useCircularStructures: this.useCircularStructures,
          basePath: this.basePath ?? [
            ...toPath([...ancestors, parent, referencingElement]),
            '$ref',
          ],
        });
        referencedElement = await visitAsync(referencedElement, visitor, {
          keyMap,
          nodeTypeGetter: getNodeType,
        });

        // remove referencing reference from ancestors lineage
        directAncestors.delete(referencingElement);
      }

      this.indirections.pop();

      const mergedElement = cloneShallow(referencedElement);

      // annotate fragment with info about original Reference element
      mergedElement.setMetaProperty('ref-fields', {
        $ref: toValue(referencingElement.$ref),
        description: toValue(referencingElement.description),
        summary: toValue(referencingElement.summary),
      });
      // annotate fragment with info about origin
      mergedElement.setMetaProperty('ref-origin', reference.uri);
      // annotate fragment with info about referencing element
      mergedElement.setMetaProperty(
        'ref-referencing-element-id',
        cloneDeep(identityManager.identify(referencingElement))
      );

      // override description and summary (outer has higher priority then inner)
      if (isObjectElement(referencedElement)) {
        if (referencingElement.hasKey('description') && 'description' in referencedElement) {
          mergedElement.remove('description');
          mergedElement.set('description', referencingElement.get('description'));
        }
        if (referencingElement.hasKey('summary') && 'summary' in referencedElement) {
          mergedElement.remove('summary');
          mergedElement.set('summary', referencingElement.get('summary'));
        }
      }

      // apply meta patches
      if (this.allowMetaPatches && isObjectElement(mergedElement)) {
        // apply meta patch only when not already applied
        if (!mergedElement.hasKey('$$ref')) {
          const baseURI = url.resolve(retrievalURI, $refBaseURI);
          mergedElement.set('$$ref', baseURI);
        }
      }

      /**
       * Transclude referencing element with merged referenced element.
       */
      link.replaceWith(mergedElement, mutationReplacer);

      /**
       * We're at the root of the tree, so we're just replacing the entire tree.
       */
      return !parent ? mergedElement : false;
    } catch (error) {
      const rootCause = getRootCause(error);
      const wrappedError = wrapError(rootCause, {
        baseDoc: this.reference.uri,
        $ref: toValue(referencingElement.$ref),
        pointer: URIFragmentIdentifier.fromURIReference(toValue(referencingElement.$ref)),
        fullPath: this.basePath ?? [...toPath([...ancestors, parent, referencingElement]), '$ref'],
      });
      this.options.dereference.dereferenceOpts?.errors?.push?.(wrappedError);

      return undefined;
    }
  }

  async PathItemElement(pathItemElement, key, parent, path, ancestors, link) {
    try {
      // ignore PathItemElement without $ref field
      if (!isStringElement(pathItemElement.$ref)) {
        return undefined;
      }

      // skip current referencing element as it's already been access
      if (this.indirections.includes(pathItemElement)) {
        return false;
      }

      // skip already identified cycled Path Item Objects
      if (includesClasses(['cycle'], pathItemElement.$ref)) {
        return false;
      }

      const [ancestorsLineage, directAncestors] = this.toAncestorLineage([...ancestors, parent]);

      const retrievalURI = this.toBaseURI(toValue(pathItemElement.$ref));
      const isInternalReference = url.stripHash(this.reference.uri) === retrievalURI;
      const isExternalReference = !isInternalReference;

      // ignore resolving internal Path Item Elements
      if (!this.options.resolve.internal && isInternalReference) {
        return undefined;
      }
      // ignore resolving external Path Item Elements
      if (!this.options.resolve.external && isExternalReference) {
        return undefined;
      }

      const reference = await this.toReference(toValue(pathItemElement.$ref));
      const $refBaseURI = url.resolve(retrievalURI, toValue(pathItemElement.$ref));

      this.indirections.push(pathItemElement);

      const jsonPointer = URIFragmentIdentifier.fromURIReference($refBaseURI);

      // possibly non-semantic referenced element
      let referencedElement = jsonPointerEvaluate(reference.value.result, jsonPointer);
      referencedElement.id = identityManager.identify(referencedElement);

      // applying semantics to a referenced element
      if (isPrimitiveElement(referencedElement)) {
        const cacheKey = `path-item-${toValue(identityManager.identify(referencedElement))}`;

        if (this.refractCache.has(cacheKey)) {
          referencedElement = this.refractCache.get(cacheKey);
        } else {
          referencedElement = PathItemElement.refract(referencedElement);
          this.refractCache.set(cacheKey, referencedElement);
        }
      }

      // detect direct or indirect reference
      if (pathItemElement === referencedElement) {
        throw new ApiDOMError('Recursive Path Item Object reference detected');
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
            type: 'path-item',
            uri: reference.uri,
            $ref: toValue(pathItemElement.$ref),
            baseURI: $refBaseURI,
            referencingElement: pathItemElement,
          });
          const replacer =
            this.options.dereference.strategyOpts['openapi-3-1']?.circularReplacer ??
            this.options.dereference.circularReplacer;
          const replacement = replacer(refElement);

          link.replaceWith(refElement, mutationReplacer);

          return !parent ? replacement : false;
        }
      }

      /**
       * Dive deep into the fragment.
       *
       * Cases to consider:
       *  1. We're crossing document boundary
       *  2. Fragment is from non-root document
       *  3. Fragment is a Path Item Object with $ref field. We need to follow it to get the eventual value
       *  4. We are dereferencing the fragment lazily/eagerly depending on circular mode
       */
      const isNonRootDocument = url.stripHash(reference.refSet.rootRef.uri) !== reference.uri;
      const shouldDetectCircular = ['error', 'replace'].includes(this.options.dereference.circular);
      if (
        (isExternalReference ||
          isNonRootDocument ||
          (isPathItemElement(referencedElement) && isStringElement(referencedElement.$ref)) ||
          shouldDetectCircular) &&
        !ancestorsLineage.includesCycle(referencedElement)
      ) {
        // append referencing schema to ancestors lineage
        directAncestors.add(pathItemElement);

        // dive deep into the referenced element
        const visitor = new OpenAPI3_1SwaggerClientDereferenceVisitor({
          reference,
          namespace: this.namespace,
          indirections: [...this.indirections],
          options: this.options,
          ancestors: ancestorsLineage,
          allowMetaPatches: this.allowMetaPatches,
          useCircularStructures: this.useCircularStructures,
          basePath: this.basePath ?? [...toPath([...ancestors, parent, pathItemElement]), '$ref'],
        });
        referencedElement = await visitAsync(referencedElement, visitor, {
          keyMap,
          nodeTypeGetter: getNodeType,
        });

        // remove referencing schema from ancestors lineage
        directAncestors.delete(pathItemElement);
      }

      this.indirections.pop();

      /**
       * Creating a new version of Path Item by merging fields from referenced Path Item with referencing one.
       */
      if (isPathItemElement(referencedElement)) {
        const mergedElement = new PathItemElement(
          [...referencedElement.content],
          cloneDeep(referencedElement.meta),
          cloneDeep(referencedElement.attributes)
        );
        // existing keywords from referencing PathItemElement overrides ones from referenced element
        pathItemElement.forEach((value, keyElement, item) => {
          mergedElement.remove(toValue(keyElement));
          mergedElement.content.push(item);
        });
        mergedElement.remove('$ref');

        // annotate referenced element with info about original referencing element
        mergedElement.setMetaProperty('ref-fields', {
          $ref: toValue(pathItemElement.$ref),
        });
        // annotate referenced element with info about origin
        mergedElement.setMetaProperty('ref-origin', reference.uri);
        // annotate fragment with info about referencing element
        mergedElement.setMetaProperty(
          'ref-referencing-element-id',
          cloneDeep(identityManager.identify(pathItemElement))
        );

        // apply meta patches
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
      const wrappedError = wrapError(rootCause, {
        baseDoc: this.reference.uri,
        $ref: toValue(pathItemElement.$ref),
        pointer: URIFragmentIdentifier.fromURIReference(toValue(pathItemElement.$ref)),
        fullPath: this.basePath ?? [...toPath([...ancestors, parent, pathItemElement]), '$ref'],
      });
      this.options.dereference.dereferenceOpts?.errors?.push?.(wrappedError);

      return undefined;
    }
  }

  async SchemaElement(referencingElement, key, parent, path, ancestors, link) {
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

          // ignore resolving internal Schema Objects
          if (!this.options.resolve.internal && isInternalReference) {
            // skip traversing this schema element but traverse all it's child elements
            return undefined;
          }
          // ignore resolving external Schema Objects
          if (!this.options.resolve.external && isExternalReference) {
            // skip traversing this schema element but traverse all it's child elements
            return undefined;
          }
        } else {
          // we're assuming here that we're dealing with JSON Pointer here
          retrievalURI = this.toBaseURI($refBaseURI);
          isInternalReference = url.stripHash(this.reference.uri) === retrievalURI;
          isExternalReference = !isInternalReference;

          // ignore resolving internal Schema Objects
          if (!this.options.resolve.internal && isInternalReference) {
            // skip traversing this schema element but traverse all it's child elements
            return undefined;
          }
          // ignore resolving external Schema Objects
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
         * No SchemaElement($id=URL) was not found, so we're going to try to resolve
         * the URL and assume the returned response is a JSON Schema.
         */
        const isSameDocumentReference =
          $refBaseURIStrippedHash === url.stripHash(this.reference.uri);

        if (
          (isURL || (isUnknownURI && isSameDocumentReference)) &&
          error instanceof EvaluationJsonSchemaUriError
        ) {
          if (isAnchor(uriToAnchor($refBaseURI))) {
            // we're dealing with JSON Schema $anchor here
            isInternalReference = url.stripHash(this.reference.uri) === retrievalURI;
            isExternalReference = !isInternalReference;

            // ignore resolving internal Schema Objects
            if (!this.options.resolve.internal && isInternalReference) {
              // skip traversing this schema element but traverse all it's child elements
              return undefined;
            }
            // ignore resolving external Schema Objects
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

            // ignore resolving internal Schema Objects
            if (!this.options.resolve.internal && isInternalReference) {
              // skip traversing this schema element but traverse all it's child elements
              return undefined;
            }
            // ignore resolving external Schema Objects
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
        throw new ApiDOMError('Recursive Schema Object reference detected');
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
            this.options.dereference.strategyOpts['openapi-3-1']?.circularReplacer ??
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
       *  3. Fragment is a Schema Object with $ref field. We need to follow it to get the eventual value
       *  4. We are dereferencing the fragment lazily/eagerly depending on circular mode
       */
      const isNonRootDocument = url.stripHash(reference.refSet.rootRef.uri) !== reference.uri;
      const shouldDetectCircular = ['error', 'replace'].includes(this.options.dereference.circular);
      if (
        (isExternalReference ||
          isNonRootDocument ||
          (isSchemaElement(referencedElement) && isStringElement(referencedElement.$ref)) ||
          shouldDetectCircular) &&
        !ancestorsLineage.includesCycle(referencedElement)
      ) {
        // append referencing schema to ancestors lineage
        directAncestors.add(referencingElement);

        // dive deep into the fragment
        const mergeVisitor = new OpenAPI3_1SwaggerClientDereferenceVisitor({
          reference,
          namespace: this.namespace,
          indirections: [...this.indirections],
          options: this.options,
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

      if (isBooleanJsonSchemaElement(referencedElement)) {
        const booleanJsonSchemaElement = cloneDeep(referencedElement);
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
       * Creating a new version of Schema Object by merging fields from referenced Schema Object with referencing one.
       */
      if (isSchemaElement(referencedElement)) {
        // Schema Object - merge keywords from referenced schema with referencing schema
        const mergedElement = new SchemaElement(
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

  // eslint-disable-next-line class-methods-use-this
  async LinkElement() {
    /**
     * OpenApi3_1DereferenceVisitor is doing lookup of Operation Objects
     * and assigns them to Link Object metadata. This is not needed in
     * swagger-client context, so we're disabling it here.
     */
    return undefined;
  }

  async ExampleElement(exampleElement, key, parent, path, ancestors, link) {
    try {
      return await super.ExampleElement(exampleElement, key, parent, path, ancestors, link);
    } catch (error) {
      const rootCause = getRootCause(error);
      const wrappedError = wrapError(rootCause, {
        baseDoc: this.reference.uri,
        externalValue: toValue(exampleElement.externalValue),
        fullPath: this.basePath ?? [
          ...toPath([...ancestors, parent, exampleElement]),
          'externalValue',
        ],
      });
      this.options.dereference.dereferenceOpts?.errors?.push?.(wrappedError);

      return undefined;
    }
  }
}

export default OpenAPI3_1SwaggerClientDereferenceVisitor;
/* eslint-enable camelcase */
