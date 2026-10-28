/* eslint-disable camelcase */
import { createNamespace, visit, cloneDeep } from '@swagger-api/apidom-core';
import { ReferenceSet, Reference } from '@swagger-api/apidom-reference/configuration/empty';
import JSONSchema2020_12DereferenceStrategy from '@swagger-api/apidom-reference/dereference/strategies/json-schema-2020-12';
import jsonSchema2020_12Namespace, {
  getNodeType,
  keyMap,
} from '@swagger-api/apidom-ns-json-schema-2020-12';

import RootVisitor from './visitors/root.js';

const visitAsync = visit[Symbol.for('nodejs.util.promisify.custom')];

class JSONSchema2020_12SwaggerClientDereferenceStrategy extends JSONSchema2020_12DereferenceStrategy {
  allowMetaPatches;

  modelPropertyMacro;

  mode;

  ancestors;

  constructor({
    allowMetaPatches = false,
    modelPropertyMacro = null,
    mode = 'non-strict',
    ancestors = [],
    ...rest
  } = {}) {
    super({ ...rest });

    this.name = 'json-schema-2020-12-swagger-client';
    this.allowMetaPatches = allowMetaPatches;
    this.modelPropertyMacro = modelPropertyMacro;
    this.mode = mode;
    this.ancestors = [...ancestors];
  }

  async dereference(file, options) {
    const namespace = createNamespace(jsonSchema2020_12Namespace);
    const immutableRefSet = options.dereference.refSet ?? new ReferenceSet();
    const mutableRefsSet = new ReferenceSet();
    let refSet = immutableRefSet;
    let reference;

    if (!immutableRefSet.has(file.uri)) {
      reference = new Reference({ uri: file.uri, value: file.parseResult });
      immutableRefSet.add(reference);
    } else {
      // pre-computed refSet was provided as configuration option
      reference = immutableRefSet.find((ref) => ref.uri === file.uri);
    }

    /**
     * Clone refSet due the dereferencing process being mutable.
     * We don't want to mutate the original refSet and the references.
     */
    if (options.dereference.immutable) {
      immutableRefSet.refs
        .map(
          (ref) =>
            new Reference({
              ...ref,
              value: cloneDeep(ref.value),
            })
        )
        .forEach((ref) => mutableRefsSet.add(ref));
      reference = mutableRefsSet.find((ref) => ref.uri === file.uri);
      refSet = mutableRefsSet;
    }

    const rootVisitor = new RootVisitor({
      reference,
      namespace,
      options,
      allowMetaPatches: this.allowMetaPatches,
      ancestors: this.ancestors,
      modelPropertyMacro: this.modelPropertyMacro,
      mode: this.mode,
    });

    const dereferencedElement = await visitAsync(refSet.rootRef.value, rootVisitor, {
      keyMap,
      nodeTypeGetter: getNodeType,
    });

    /**
     * If immutable option is set, replay refs from the refSet.
     */
    if (options.dereference.immutable) {
      mutableRefsSet.refs
        .filter((ref) => ref.uri.startsWith('immutable://'))
        .map(
          (ref) =>
            new Reference({
              ...ref,
              uri: ref.uri.replace(/^immutable:\/\//, ''),
            })
        )
        .forEach((ref) => immutableRefSet.add(ref));
    }

    /**
     * Release all memory if this refSet was not provided as an configuration option.
     * If provided as configuration option, then provider is responsible for cleanup.
     */
    if (options.dereference.refSet === null) {
      immutableRefSet.clean();
    }

    mutableRefsSet.clean();

    return dereferencedElement;
  }
}

export default JSONSchema2020_12SwaggerClientDereferenceStrategy;
/* eslint-enable camelcase */
