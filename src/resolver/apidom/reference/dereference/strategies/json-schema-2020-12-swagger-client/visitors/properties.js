import { isObjectElement, toValue } from '@swagger-api/apidom-core';

import toPath from '../utils/to-path.js';

class ModelPropertyMacroVisitor {
  modelPropertyMacro;

  options;

  JSONSchema202012Element = {
    leave: (schemaElement, key, parent, path, ancestors) => {
      if (typeof schemaElement.properties === 'undefined') return;
      if (!isObjectElement(schemaElement.properties)) return;

      schemaElement.properties.forEach((property) => {
        if (!isObjectElement(property)) return;

        try {
          const macroValue = this.modelPropertyMacro(toValue(property));
          property.set('default', macroValue);
        } catch (error) {
          const macroError = new Error(error, { cause: error });
          macroError.fullPath = [...toPath([...ancestors, parent, schemaElement]), 'properties'];
          this.options.dereference.dereferenceOpts?.errors?.push?.(macroError);
        }
      });
    },
  };

  constructor({ modelPropertyMacro, options }) {
    this.modelPropertyMacro = modelPropertyMacro;
    this.options = options;
  }
}

export default ModelPropertyMacroVisitor;
