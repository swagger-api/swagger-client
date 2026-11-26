/* eslint-disable camelcase */
import { dispatchRefractorPlugins, isObjectElement, toValue } from '@swagger-api/apidom-core';
import {
  refractorPluginNormalizeOperationIds,
  refractorPluginNormalizeParameters,
  refractorPluginNormalizeSecurityRequirements,
  refractorPluginNormalizeParameterExamples,
  refractorPluginNormalizeHeaderExamples,
  createToolbox,
  keyMap,
  getNodeType,
  OpenApi3_1Element,
} from '@swagger-api/apidom-ns-openapi-3-1';

import opId from '../../../helpers/op-id.js';
import resolveOpenAPI31Strategy from './resolve.js';

const normalize = (element) => {
  if (!isObjectElement(element)) return element;

  const plugins = [
    refractorPluginNormalizeOperationIds({
      operationIdNormalizer: (operationId, path, method) =>
        opId({ operationId }, path, method, { v2OperationIdCompatibilityMode: false }),
    }),
    refractorPluginNormalizeParameters(),
    refractorPluginNormalizeSecurityRequirements(),
    refractorPluginNormalizeParameterExamples(),
    refractorPluginNormalizeHeaderExamples(),
  ];

  const normalized = dispatchRefractorPlugins(element, plugins, {
    toolboxCreator: createToolbox,
    visitorOptions: { keyMap, nodeTypeGetter: getNodeType },
  });

  return normalized;
};

/**
 * This adapter allow to perform normalization on Plain Old JavaScript Objects.
 * The function adapts the `normalize` function interface and is able to accept
 * Plain Old JavaScript Objects and returns Plain Old JavaScript Objects.
 */
const pojoCache = new WeakMap();

export const pojoAdapter = (normalizeFn) => (spec) => {
  if (!pojoCache.has(normalizeFn)) pojoCache.set(normalizeFn, new WeakMap());
  const cache = pojoCache.get(normalizeFn);
  if (cache.has(spec)) return cache.get(spec);

  const openApiElement = OpenApi3_1Element.refract(spec);
  openApiElement.classes.push('result');

  const normalized = normalizeFn(openApiElement);
  const value = toValue(normalized);

  /**
   * We're setting the cache here to avoid repeated refracting
   * in `openapi-3-1-apidom` strategy resolve method.
   */
  resolveOpenAPI31Strategy.cache.set(value, normalized);
  cache.set(spec, value);

  return value;
};

export default normalize;
/* eslint-enable camelcase */
