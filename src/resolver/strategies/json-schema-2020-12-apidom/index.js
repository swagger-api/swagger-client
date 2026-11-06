import resolveJSONSchema202012Strategy from './resolve.js';
import { isJSONSchema202012 } from '../../../helpers/json-schema-predicates.js';

const jsonSchema202012ApiDOMStrategy = {
  name: 'json-schema-2020-12-apidom',
  match(spec) {
    return isJSONSchema202012(spec);
  },
  // Standalone JSON Schema documents have nothing to normalize. The method is still required:
  // `resolveSubtree` calls `strategy.normalize` on every strategy.
  normalize(spec) {
    return spec;
  },
  async resolve(options) {
    return resolveJSONSchema202012Strategy(options);
  },
};

export default jsonSchema202012ApiDOMStrategy;
