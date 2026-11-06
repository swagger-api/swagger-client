import { isFreelyNamed, generateAbsoluteRefPatches } from '../helpers.js';

export default {
  key: 'allOf',
  plugin: (val, key, fullPath, specmap, patch) => {
    // Ignore replace patches created by $ref because the changes will
    // occur in the original "add" patch and we don't want this plugin
    // to redundantly processes those "relace" patches.
    if (patch.meta && patch.meta.$$ref) {
      return undefined;
    }

    const parent = fullPath.slice(0, -1);
    if (isFreelyNamed(parent)) {
      return undefined;
    }

    if (!Array.isArray(val)) {
      const err = new TypeError('allOf must be an array');
      err.fullPath = fullPath; // This is an array
      return err;
    }

    let alreadyAddError = false;

    // Find the original definition from the `patch.value` object
    // Remove the `allOf` property so it doesn't get added to the result of the `allOf` plugin
    let originalDefinitionObj = patch.value;
    parent.forEach((part) => {
      if (!originalDefinitionObj) return; // bail out if we've lost sight of our target
      originalDefinitionObj = originalDefinitionObj[part];
    });
    originalDefinitionObj = { ...originalDefinitionObj };

    // when we've lost sight, interrupt prematurely
    if (Object.keys(originalDefinitionObj).length === 0) {
      return undefined;
    }

    delete originalDefinitionObj.allOf;

    const patches = [];

    // Generate patches that migrate $ref values based on ContextTree information,
    // while each member is still in place at `allOf/<i>`: the members are about to
    // be merged onto the parent, and deepmerge concatenates arrays, so a member's
    // `oneOf/0` may end up at `oneOf/2` (swagger-api/swagger-ui#11018).
    //
    // These have to stay patches. Applying them also re-runs the refs plugin over
    // each $ref, which is what keeps the cycle detection in refs.js fed; resolving
    // the values inline instead lets recursive schemas expand without bound. The
    // test that catches that is test/resolver/specmap/complex.js, not this plugin's.
    val.forEach((toMerge, i) => {
      if (specmap.isObject(toMerge)) {
        // String(i), because a numeric token breaks escapeJsonPointerToken()
        patches.push(...generateAbsoluteRefPatches(toMerge, [...fullPath, String(i)], { specmap }));
      }
    });

    // remove existing content
    patches.push(specmap.replace(parent, {}));

    val.forEach((toMerge) => {
      if (!specmap.isObject(toMerge)) {
        if (alreadyAddError) {
          return null;
        }
        alreadyAddError = true;

        const err = new TypeError('Elements in allOf must be objects');
        err.fullPath = fullPath; // This is an array
        return patches.push(err);
      }

      // Deeply merge the member's contents onto the parent location
      patches.push(specmap.mergeDeep(parent, toMerge));

      return undefined;
    });

    // If there was an example in the original definition,
    // keep it instead of merging with examples from other schema
    if (originalDefinitionObj.example) {
      // Delete other schema examples
      patches.push(specmap.remove([].concat(parent, 'example')));
    }
    // Merge back the values from the original definition
    patches.push(specmap.mergeDeep(parent, originalDefinitionObj));

    // If there was not an original $$ref value, make sure to remove
    // any $$ref value that may exist from the result of `allOf` merges
    if (!originalDefinitionObj.$$ref) {
      patches.push(specmap.remove([].concat(parent, '$$ref')));
    }

    return patches;
  },
};
