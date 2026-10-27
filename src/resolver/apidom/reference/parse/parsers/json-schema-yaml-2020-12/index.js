/* eslint-disable camelcase */
import YAML, { JSON_SCHEMA } from 'js-yaml';
import { ParseResultElement } from '@swagger-api/apidom-core';
import { ParserError, Parser } from '@swagger-api/apidom-reference/configuration/empty';
import {
  mediaTypes,
  refract,
  JSONSchema202012MediaTypes,
} from '@swagger-api/apidom-ns-json-schema-2020-12';

import { isJSONSchema202012 } from '../../../../../../helpers/json-schema-predicates.js';

class JSONSchemaYAML2020_12Parser extends Parser {
  constructor(options = {}) {
    super({
      name: 'json-schema-yaml-2020-12-swagger-client',
      mediaTypes: new JSONSchema202012MediaTypes(
        ...mediaTypes.filterByFormat('generic'),
        ...mediaTypes.filterByFormat('yaml')
      ),
      ...options,
    });
  }

  async canParse(file) {
    const hasSupportedFileExtension =
      this.fileExtensions.length === 0 ? true : this.fileExtensions.includes(file.extension);
    const hasSupportedMediaType = this.mediaTypes.includes(file.mediaType);

    if (!hasSupportedFileExtension) return false;
    if (hasSupportedMediaType) return true;
    if (!hasSupportedMediaType) {
      /**
       * Detection uses the parsed document root: a text match would also
       * claim documents with a nested $schema only.
       */
      try {
        return isJSONSchema202012(YAML.load(file.toString(), { schema: JSON_SCHEMA }));
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  async parse(file) {
    if (this.sourceMap) {
      throw new ParserError(
        "json-schema-yaml-2020-12-swagger-client parser plugin doesn't support sourceMaps option"
      );
    }

    const parseResultElement = new ParseResultElement();
    const source = file.toString();

    try {
      const pojo = YAML.load(source, { schema: JSON_SCHEMA });

      if (this.allowEmpty && typeof pojo === 'undefined') {
        return parseResultElement;
      }

      const element = refract(pojo, this.refractorOpts);
      element.classes.push('result');
      parseResultElement.push(element);
      return parseResultElement;
    } catch (error) {
      throw new ParserError(`Error parsing "${file.uri}"`, { cause: error });
    }
  }
}

export default JSONSchemaYAML2020_12Parser;
/* eslint-enable camelcase */
