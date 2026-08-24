import { forEach } from 'neotraverse';
import { url } from '@swagger-api/apidom-reference/configuration/empty';

import { DEFAULT_BASE_URL } from '../../constants.js';

// This will match if the direct parent's key exactly matches an item.
const freelyNamedKeyParents = ['properties'];

// This will match if the grandparent's key exactly matches an item.
// NOTE that this is for finding non-free paths!
const nonFreelyNamedKeyGrandparents = ['properties'];

// This will match if the joined parent path exactly matches an item.
//
// This is mostly useful for filtering out root-level reusable item names,
// for example `["definitions", "$ref"]`
const freelyNamedPaths = [
  // Swagger 2.0
  'definitions',
  'parameters',
  'responses',
  'securityDefinitions',

  // OpenAPI 3.0
  'components/schemas',
  'components/responses',
  'components/parameters',
  'components/securitySchemes',
];

// This will match if any of these items are substrings of the joined
// parent path.
//
// Warning! These are powerful. Beware of edge cases.
const freelyNamedAncestors = ['schema/example', 'items/example'];

export function isFreelyNamed(parentPath) {
  const parentKey = parentPath[parentPath.length - 1];
  const grandparentKey = parentPath[parentPath.length - 2];
  const parentStr = parentPath.join('/');

  return (
    // eslint-disable-next-line max-len
    (freelyNamedKeyParents.indexOf(parentKey) > -1 &&
      nonFreelyNamedKeyGrandparents.indexOf(grandparentKey) === -1) ||
    freelyNamedPaths.indexOf(parentStr) > -1 ||
    freelyNamedAncestors.some((el) => parentStr.indexOf(el) > -1)
  );
}

export function generateAbsoluteRefPatches(
  obj,
  basePath,
  {
    specmap,
    getBaseUrlForNodePath = (path) => specmap.getContext([...basePath, ...path]).baseDoc,
    targetKeys = ['$ref', '$$ref'],
  } = {}
) {
  const patches = [];

  forEach(obj, (ctx, node) => {
    if (targetKeys.includes(ctx.key) && typeof node === 'string') {
      const nodePath = ctx.path; // this node's path, relative to `obj`
      const fullPath = basePath.concat(ctx.path);

      const absolutifiedRefValue = absolutifyPointer(node, getBaseUrlForNodePath(nodePath));

      patches.push(specmap.replace(fullPath, absolutifiedRefValue));
    }
  });

  return patches;
}

export function absolutifyPointer(pointer, baseUrl) {
  const [urlPart, fragmentPart] = pointer.split('#');
  const safeBaseUrl = baseUrl ?? '';
  const safeUrlPart = urlPart ?? '';
  let newRefUrlPart;

  if (!url.isHttpUrl(safeBaseUrl)) {
    const absoluteBaseUrl = url.resolve(DEFAULT_BASE_URL, safeBaseUrl);
    const absoluteRefUrlPart = url.resolve(absoluteBaseUrl, safeUrlPart);
    const rawRefUrlPart = absoluteRefUrlPart.replace(DEFAULT_BASE_URL, '');
    newRefUrlPart = safeUrlPart.startsWith('/') ? rawRefUrlPart : rawRefUrlPart.substring(1);
  } else {
    newRefUrlPart = url.resolve(safeBaseUrl, safeUrlPart);
  }

  return fragmentPart ? `${newRefUrlPart}#${fragmentPart}` : newRefUrlPart;
}
