import resolveJSONSchema202012Strategy from './resolve.js';
import normalize from './normalize.js';
import { isJSONSchema202012 } from '../../../helpers/json-schema-predicates.js';

const jsonSchema202012ApiDOMStrategy = {
  name: 'json-schema-2020-12-apidom',
  match(spec) {
    return isJSONSchema202012(spec);
  },
  normalize(spec) {
    return normalize(spec);
  },
  async resolve(options) {
    return resolveJSONSchema202012Strategy(options);
  },
};

export default jsonSchema202012ApiDOMStrategy;
