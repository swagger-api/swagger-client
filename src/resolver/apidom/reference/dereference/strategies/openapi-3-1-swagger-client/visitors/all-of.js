import { uniqWith } from 'ramda';
import {
  isArrayElement,
  isObjectElement,
  deepmerge,
  toValue,
  cloneShallow,
  includesClasses,
} from '@swagger-api/apidom-core';
import { isSchemaElement } from '@swagger-api/apidom-ns-openapi-3-1';

import toPath from '../utils/to-path.js';

const childrenOf = (el) => {
  const c = el && el.content;
  if (Array.isArray(c)) return c;
  if (c && typeof c === 'object' && 'key' in c) return [c.key, c.value];
  if (c && typeof c === 'object' && c.element) return [c];
  return [];
};
const hasCycle = (el, onPath = new Set(), done = new Set()) => {
  if (!el || typeof el !== 'object') return false;
  if (onPath.has(el)) return true;
  if (done.has(el)) return false;
  onPath.add(el);
  const found = childrenOf(el).some((child) => hasCycle(child, onPath, done));
  onPath.delete(el);
  done.add(el);
  return found;
};

class AllOfVisitor {
  options;

  SchemaElement = {
    leave(schemaElement, key, parent, path, ancestors) {
      // do nothing
      if (typeof schemaElement.allOf === 'undefined') return undefined;

      // collect error and return if allOf keyword is not an array
      if (!isArrayElement(schemaElement.allOf)) {
        const error = new TypeError('allOf must be an array');
        error.fullPath = [...toPath([...ancestors, parent, schemaElement]), 'allOf'];
        this.options.dereference.dereferenceOpts?.errors?.push?.(error);
        return undefined;
      }

      // remove allOf keyword if empty
      if (schemaElement.allOf.isEmpty) {
        schemaElement.remove('allOf');
        return undefined;
      }

      // collect errors if allOf keyword contains anything else than Schema Object
      // circular references are replaced by generic ObjectElement containing only $ref (see circularReplacer)
      const isCircularReplacement = (element) =>
        isObjectElement(element) && !isSchemaElement(element) && element.hasKey('$ref');
      const includesSchemaElementOnly = schemaElement.allOf.content.every(
        (element) => isSchemaElement(element) || isCircularReplacement(element)
      );
      if (!includesSchemaElementOnly) {
        const error = new TypeError('Elements in allOf must be objects');
        error.fullPath = [...toPath([...ancestors, parent, schemaElement]), 'allOf'];
        this.options.dereference.dereferenceOpts?.errors?.push?.(error);
        return undefined;
      }

      // variant: never merge when a circular placeholder is present
      if (schemaElement.allOf.content.some((item) => isCircularReplacement(item))) {
        return undefined;
      }
      // deepmerge cannot handle cyclic element graphs
      if ([...schemaElement.allOf.content, schemaElement].some((item) => hasCycle(item))) {
        return undefined;
      }

      while (schemaElement.hasKey('allOf')) {
        const { allOf } = schemaElement;
        schemaElement.remove('allOf');
        const allOfMerged = deepmerge.all([...allOf.content, schemaElement], {
          customMerge: (keyElement) => {
            if (toValue(keyElement) === 'enum') {
              return (targetElement, sourceElement) => {
                if (
                  includesClasses(['json-schema-enum'], targetElement) &&
                  includesClasses(['json-schema-enum'], sourceElement)
                ) {
                  const areElementsEqual = (a, b) => {
                    if (
                      isArrayElement(a) ||
                      isArrayElement(b) ||
                      isObjectElement(a) ||
                      isObjectElement(b)
                    ) {
                      return false;
                    }
                    return a.equals(toValue(b));
                  };
                  const clone = cloneShallow(targetElement);
                  clone.content = uniqWith(areElementsEqual)([
                    ...targetElement.content,
                    ...sourceElement.content,
                  ]);

                  return clone;
                }
                return deepmerge(targetElement, sourceElement);
              };
            }
            return deepmerge;
          },
        });

        /**
         * If there was not an original $$ref value, make sure to remove
         * any $$ref value that may exist from the result of `allOf` merges.
         */
        if (!schemaElement.hasKey('$$ref')) {
          allOfMerged.remove('$$ref');
        }

        /**
         * If there was an example keyword in the original schema,
         * keep it instead of merging with example from other schema.
         */
        if (schemaElement.hasKey('example')) {
          const member = allOfMerged.getMember('example');
          if (member) {
            member.value = schemaElement.get('example');
          }
        }

        /**
         * If there was an examples keyword in the original schema,
         * keep it instead of merging with examples from other schema.
         */
        if (schemaElement.hasKey('examples')) {
          const member = allOfMerged.getMember('examples');
          if (member) {
            member.value = schemaElement.get('examples');
          }
        }

        schemaElement.content = allOfMerged.content;
      }

      return undefined;
    },
  };

  constructor({ options }) {
    this.options = options;
  }
}

export default AllOfVisitor;
