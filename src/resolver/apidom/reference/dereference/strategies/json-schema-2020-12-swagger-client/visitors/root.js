import { mergeAllVisitors } from '@swagger-api/apidom-core';
import { getNodeType } from '@swagger-api/apidom-ns-json-schema-2020-12';

import ModelPropertyMacroVisitor from './properties.js';
import AllOfVisitor from './all-of.js';
import JSONSchema2020_12SwaggerClientDereferenceVisitor from './dereference.js'; // eslint-disable-line camelcase

const mergeAllVisitorsAsync = mergeAllVisitors[Symbol.for('nodejs.util.promisify.custom')];

/**
 * Same visitors as for OpenAPI 3.1 Schema Objects, so that a schema resolves the same
 * standalone and inside an OpenAPI 3.1 document. There is no parameter macro:
 * JSON Schema documents have no Parameter Objects.
 */
class RootVisitor {
  constructor({ modelPropertyMacro, mode, options, ...rest }) {
    const visitors = [];

    visitors.push(
      new JSONSchema2020_12SwaggerClientDereferenceVisitor({
        ...rest,
        options,
      })
    );

    if (typeof modelPropertyMacro === 'function') {
      visitors.push(new ModelPropertyMacroVisitor({ modelPropertyMacro, options }));
    }

    if (mode !== 'strict') {
      visitors.push(new AllOfVisitor({ options }));
    }

    const mergedVisitor = mergeAllVisitorsAsync(visitors, { nodeTypeGetter: getNodeType });
    Object.assign(this, mergedVisitor);
  }
}

export default RootVisitor;
