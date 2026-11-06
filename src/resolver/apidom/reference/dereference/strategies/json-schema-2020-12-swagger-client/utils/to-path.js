import { isMemberElement, isArrayElement, toValue } from '@swagger-api/apidom-core';

const trimParseResult = (elementPath) => elementPath.slice(2);

/**
 * Transforms ApiDOM traversal meta information into
 * SwaggerClient compatible path.
 *
 * SwaggerClient path is a list of JSON Pointer tokens.
 */
const toPath = (elementPath) => {
  const elementPathSanitized = trimParseResult(elementPath);

  return elementPathSanitized.reduce((path, element, index) => {
    if (isMemberElement(element)) {
      const token = String(toValue(element.key));
      path.push(token);
    } else if (isArrayElement(elementPathSanitized[index - 2])) {
      const token = elementPathSanitized[index - 2].content.indexOf(element);
      path.push(token);
    }

    return path;
  }, []);
};

export default toPath;
