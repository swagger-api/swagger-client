import jsYaml from 'js-yaml';
import { ApiDOMStructuredError } from '@swagger-api/apidom-error';
import { url } from '@swagger-api/apidom-reference/configuration/empty';

import lib from './index.js';
import { isFreelyNamed, absolutifyPointer } from '../helpers.js';
import { ACCEPT_HEADER_VALUE_FOR_DOCUMENTS } from '../../../constants.js';

const ABSOLUTE_URL_REGEXP = /^([a-z]+:\/\/|\/\/)/i;

class JSONRefError extends ApiDOMStructuredError {}

const docCache = {};
const specmapRefs = new WeakMap();

const skipResolutionTestFns = [
  // OpenAPI 2.0 response examples
  (path) =>
    // ["paths", *, *, "responses", *, "examples"]
    path[0] === 'paths' && path[3] === 'responses' && path[5] === 'examples',

  // OpenAPI 3.0 Response Media Type Examples
  (path) =>
    // ["paths", *, *, "responses", *, "content", *, "example"]
    path[0] === 'paths' &&
    path[3] === 'responses' &&
    path[5] === 'content' &&
    path[7] === 'example',
  (path) =>
    // ["paths", *, *, "responses", *, "content", *, "examples", *, "value"]
    path[0] === 'paths' &&
    path[3] === 'responses' &&
    path[5] === 'content' &&
    path[7] === 'examples' &&
    path[9] === 'value',

  // OpenAPI 3.0 Request Body Media Type Examples
  (path) =>
    // ["paths", *, *, "requestBody", "content", *, "example"]
    path[0] === 'paths' &&
    path[3] === 'requestBody' &&
    path[4] === 'content' &&
    path[6] === 'example',
  (path) =>
    // ["paths", *, *, "requestBody", "content", *, "examples", *, "value"]
    path[0] === 'paths' &&
    path[3] === 'requestBody' &&
    path[4] === 'content' &&
    path[6] === 'examples' &&
    path[8] === 'value',

  // OAS 3.0 Parameter Examples
  (path) =>
    // ["paths", *, "parameters", *, "example"]
    path[0] === 'paths' && path[2] === 'parameters' && path[4] === 'example',
  (path) =>
    // ["paths", *, *, "parameters", *, "example"]
    path[0] === 'paths' && path[3] === 'parameters' && path[5] === 'example',
  (path) =>
    // ["paths", *, "parameters", *, "examples", *, "value"]
    path[0] === 'paths' &&
    path[2] === 'parameters' &&
    path[4] === 'examples' &&
    path[6] === 'value',
  (path) =>
    // ["paths", *, *, "parameters", *, "examples", *, "value"]
    path[0] === 'paths' &&
    path[3] === 'parameters' &&
    path[5] === 'examples' &&
    path[7] === 'value',
  (path) =>
    // ["paths", *, "parameters", *, "content", *, "example"]
    path[0] === 'paths' &&
    path[2] === 'parameters' &&
    path[4] === 'content' &&
    path[6] === 'example',
  (path) =>
    // ["paths", *, "parameters", *, "content", *, "examples", *, "value"]
    path[0] === 'paths' &&
    path[2] === 'parameters' &&
    path[4] === 'content' &&
    path[6] === 'examples' &&
    path[8] === 'value',
  (path) =>
    // ["paths", *, *, "parameters", *, "content", *, "example"]
    path[0] === 'paths' &&
    path[3] === 'parameters' &&
    path[4] === 'content' &&
    path[7] === 'example',
  (path) =>
    // ["paths", *, *, "parameters", *, "content", *, "examples", *, "value"]
    path[0] === 'paths' &&
    path[3] === 'parameters' &&
    path[5] === 'content' &&
    path[7] === 'examples' &&
    path[9] === 'value',
];

const shouldSkipResolution = (path) => skipResolutionTestFns.some((fn) => fn(path));

// =========================
// Core
// =========================

/**
 * This plugin resolves the JSON pointers.
 * A major part of this plugin deals with cyclic references via 2 mechanisms.
 * 1. If a pointer was already resolved before in this path, halt.
 * 2. If the patch value points to one of the ancestors in this path, halt.
 *
 * Note that either one of these mechanism is sufficient, both must be in place.
 * For examples:
 *
 * Given the following spec, #1 alone is insufficient because after the 2nd
 * application, there will be a cyclic object reference.
 *   a.b.c: $ref-d
 *   d.e.f: $ref-a (per #1, safe to return patch as no immediate cycle)
 *
 * Given the following spec, #2 alone is insufficient because although there will
 * never be any cyclic object reference, the plugin will keep producing patches.
 *   a: $ref-b
 *   b: $ref-a
 */
const plugin = {
  key: '$ref',
  plugin: (ref, key, fullPath, specmap) => {
    const specmapInstance = specmap.getInstance();
    const parent = fullPath.slice(0, -1);

    if (isFreelyNamed(parent) || shouldSkipResolution(parent)) {
      return undefined;
    }

    const context = specmap.getContext(fullPath);
    const { baseDoc } = context;
    if (typeof ref !== 'string') {
      return new JSONRefError('$ref: must be a string (JSON-Ref)', {
        $ref: ref,
        baseDoc,
        fullPath,
      });
    }

    const splitString = split(ref);
    const refPath = splitString[0];
    const pointer = splitString[1] || '';

    let basePath;
    try {
      basePath = baseDoc || refPath ? absoluteify(refPath, baseDoc) : null;
    } catch (e) {
      return wrapError(e, {
        pointer,
        $ref: ref,
        basePath,
        fullPath,
      });
    }

    const fullyQualifiedRef = fullyQualifyRef(basePath, pointer);
    const refStack = context.refStack || [];
    let promOrVal;
    let tokens;

    if (
      refStack.indexOf(fullyQualifiedRef) > -1 ||
      pointerAlreadyInPath(pointer, basePath, parent, specmap)
    ) {
      // Cyclic reference!
      // if `useCircularStructures` is not set, just leave the reference
      // unresolved, but absolutify it so that we don't leave an invalid $ref
      // path in the content
      if (!specmapInstance.useCircularStructures) {
        const absolutifiedRef = absolutifyPointer(ref, basePath);

        if (ref === absolutifiedRef) {
          // avoids endless looping
          // without this, the ref plugin never stops seeing this $ref
          return null;
        }
        return lib.replace(fullPath, absolutifiedRef);
      }
    }

    if (basePath == null) {
      tokens = jsonPointerToArray(pointer);
      promOrVal = specmap.get(tokens);

      if (typeof promOrVal === 'undefined') {
        promOrVal = new JSONRefError(`Could not resolve reference: ${ref}`, {
          pointer,
          $ref: ref,
          baseDoc,
          fullPath,
        });
      }
    } else {
      promOrVal = extractFromDoc(basePath, pointer);
      // eslint-disable-next-line no-underscore-dangle
      if (promOrVal.__value != null) {
        promOrVal = promOrVal.__value; // eslint-disable-line no-underscore-dangle
      } else {
        promOrVal = promOrVal.catch((e) => {
          throw wrapError(e, {
            pointer,
            $ref: ref,
            baseDoc,
            fullPath,
          });
        });
      }
    }

    if (promOrVal instanceof Error) {
      return [lib.remove(fullPath), promOrVal];
    }

    const absolutifiedRef = absolutifyPointer(ref, basePath);

    const patch = lib.replace(parent, promOrVal, { $$ref: absolutifiedRef });
    const resolvedContext = { refStack: refStack.concat(fullyQualifiedRef) };
    if (basePath || baseDoc) {
      resolvedContext.baseDoc = basePath;
    }
    const contextPatch = lib.context(parent, resolvedContext);

    try {
      // prevents circular values from being constructed, unless we specifically
      // want that to happen
      if (!patchValueAlreadyInPath(specmap.state, patch) || specmapInstance.useCircularStructures) {
        return [patch, contextPatch];
      }
    } catch (e) {
      // if we're catching here, path traversal failed, so we should
      // ditch without sending any patches back up.
      //
      // this is a narrow fix for the larger problem of patches being queued
      // and then having the state they were generated against be modified
      // before they are applied.
      //
      // TODO: re-engineer specmap patch/state management to avoid this
      return null;
    }

    return undefined;
  },
};

const mod = Object.assign(plugin, {
  docCache,
  absoluteify,
  clearCache,
  JSONRefError,
  wrapError,
  getDoc,
  split,
  extractFromDoc,
  fetchJSON,
  extract,
  jsonPointerToArray,
  unescapeJsonPointerToken,
});

export default mod;

// =========================
// Utilities
// =========================

/**
 * Resolves a path and its base to an abolute URL.
 * @api public
 */
function absoluteify(path, basePath) {
  if (!ABSOLUTE_URL_REGEXP.test(path)) {
    if (!basePath) {
      throw new JSONRefError(
        `Tried to resolve a relative URL, without having a basePath. path: '${path}' basePath: '${basePath}'`
      );
    }
    return url.resolve(basePath, path);
  }
  return path;
}

/**
 * Wraps an error as JSONRefError.
 * @param  {Error} e      the error.
 * @param  {Object} extra (optional) optional data.
 * @return {Error}        an instance of JSONRefError.
 * @api public
 */
function wrapError(e, extra) {
  let message;

  if (e && e.response && e.response.body) {
    message = `${e.response.body.code} ${e.response.body.message}`;
  } else {
    message = e.message;
  }

  return new JSONRefError(`Could not resolve reference: ${message}`, {
    ...extra,
    cause: e,
  });
}

/**
 * Splits a pointer by the hash delimiter.
 * @api public
 */
function split(ref) {
  return (ref + '').split('#'); // eslint-disable-line prefer-template
}

/**
 * Extracts a pointer from its document.
 * @param  {String} docPath the absolute document URL.
 * @param  {String} pointer the pointer whose value is to be extracted.
 * @return {Promise}        a promise of the pointer value.
 * @api public
 */
function extractFromDoc(docPath, pointer) {
  const doc = docCache[docPath];
  if (doc && !lib.isPromise(doc)) {
    // If doc is already available, return __value together with the promise.
    // __value is for special handling in cycle check:
    // pointerAlreadyInPath() won't work if patch.value is a promise,
    // thus when that promise is finally resolved, cycle might happen (because
    // `spec` and `docCache[basePath]` refer to the exact same object).
    // See test "should resolve a cyclic spec when baseDoc is specified".
    try {
      const v = extract(pointer, doc);
      return Object.assign(Promise.resolve(v), { __value: v });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  return getDoc(docPath).then((_doc) => extract(pointer, _doc));
}

/**
 * Clears all document caches.
 * @param  {String} item (optional) the name of the cache item to be cleared.
 * @api public
 */
function clearCache(item) {
  if (typeof item !== 'undefined') {
    delete docCache[item];
  } else {
    Object.keys(docCache).forEach((key) => {
      delete docCache[key];
    });
  }
}

/**
 * Fetches and caches a document.
 * @param  {String} docPath the absolute URL of the document.
 * @return {Promise}        a promise of the document content.
 * @api public
 */
function getDoc(docPath) {
  const val = docCache[docPath];
  if (val) {
    return lib.isPromise(val) ? val : Promise.resolve(val);
  }

  // NOTE: we need to use `mod.fetchJSON` in order to be able to overwrite it.
  // Any tips on how to make this cleaner, please ping!
  docCache[docPath] = mod.fetchJSON(docPath).then((doc) => {
    docCache[docPath] = doc;
    return doc;
  });
  return docCache[docPath];
}

/**
 * Fetches a document.
 * @param  {String} docPath the absolute URL of the document.
 * @return {Promise}        a promise of the document content.
 * @api public
 */
function fetchJSON(docPath) {
  return fetch(docPath, { headers: { Accept: ACCEPT_HEADER_VALUE_FOR_DOCUMENTS }, loadSpec: true })
    .then((res) => res.text())
    .then((text) => jsYaml.load(text));
}

/**
 * Extracts a pointer from an object.
 * @param  {String[]} pointer the JSON pointer.
 * @param  {Object} obj       an object whose value is to be extracted.
 * @return {Object}           the value to be extracted.
 * @api public
 */
function extract(pointer, obj) {
  const tokens = jsonPointerToArray(pointer);
  if (tokens.length < 1) {
    return obj;
  }

  const val = lib.getIn(obj, tokens);
  if (typeof val === 'undefined') {
    throw new JSONRefError(`Could not resolve pointer: ${pointer} does not exist in document`, {
      pointer,
    });
  }
  return val;
}

/**
 * Converts a JSON pointer to array.
 * @api public
 */
function jsonPointerToArray(pointer) {
  if (typeof pointer !== 'string') {
    throw new TypeError(`Expected a string, got a ${typeof pointer}`);
  }

  if (pointer[0] === '/') {
    pointer = pointer.substr(1);
  }

  if (pointer === '') {
    return [];
  }

  return pointer.split('/').map(unescapeJsonPointerToken);
}

/**
 * Unescapes a JSON pointer.
 * @api public
 */
function unescapeJsonPointerToken(token) {
  if (typeof token !== 'string') {
    return token;
  }

  const params = new URLSearchParams(`=${token.replace(/~1/g, '/').replace(/~0/g, '~')}`);
  return params.get('');
}

/**
 * Escapes a JSON pointer.
 * @api public
 */
function escapeJsonPointerToken(token) {
  const params = new URLSearchParams([['', token.replace(/~/g, '~0').replace(/\//g, '~1')]]);
  return params.toString().slice(1);
}

function arrayToJsonPointer(arr) {
  if (arr.length === 0) {
    return '';
  }

  return `/${arr.map(escapeJsonPointerToken).join('/')}`;
}

function fullyQualifyRef(basePath, pointer) {
  return `${basePath || '<specmap-base>'}#${pointer}`;
}

const pointerBoundaryChar = (c) => !c || c === '/' || c === '#';

function pointerIsAParent(pointer, parentPointer) {
  if (pointerBoundaryChar(parentPointer)) {
    // This is the root of the document, so its naturally a parent
    return true;
  }
  const nextChar = pointer.charAt(parentPointer.length);
  const lastParentChar = parentPointer.slice(-1);

  return (
    pointer.indexOf(parentPointer) === 0 &&
    (!nextChar || nextChar === '/' || nextChar === '#') &&
    lastParentChar !== '#'
  );
}

// =========================
// Private
// =========================

/**
 * Checks if this pointer points back to one or more pointers along the path.
 */
function pointerAlreadyInPath(pointer, basePath, parent, specmap) {
  let refs = specmapRefs.get(specmap);
  if (!refs) {
    // Stores all resolved references of a specmap instance.
    // Schema: path -> pointer (path's $ref value).
    refs = {};
    specmapRefs.set(specmap, refs);
  }

  const parentPointer = arrayToJsonPointer(parent);
  const fullyQualifiedPointer = fullyQualifyRef(basePath, pointer);

  // dirty hack to strip `allof/[index]` from the path, in order to avoid cases
  // where we get false negatives because:
  // - we resolve a path, then
  // - allOf plugin collapsed `allOf/[index]` out of the path, then
  // - we try to work on a child $ref within that collapsed path.
  //
  // because of the path collapse, we lose track of it in our specmapRefs hash
  // solution: always throw the allOf constructs out of paths we store
  // TODO: solve this with a global register, or by writing more metadata in
  // either allOf or refs plugin
  const safeParentPointer = normalizeAllOfPath(parentPointer);

  // Case 1: direct cycle, e.g. a.b.c.$ref: '/a.b'
  // Detect by checking that the parent path doesn't start with pointer.
  // This only applies if the pointer is internal, i.e. basePath === rootPath (could be null)
  const rootDoc = specmap.contextTree.get([]).baseDoc;
  if (basePath === rootDoc && pointerIsAParent(safeParentPointer, pointer)) {
    // eslint-disable-line
    return true;
  }

  // Case 2: indirect cycle
  //  ex1: a.$ref: '/b'  &  b.c.$ref: '/b/c'
  //  ex2: a.$ref: '/b/c'  &  b.c.$ref: '/b'
  // Detect by retrieving all the $refs along the path of parent
  // and checking if any starts with pointer or vice versa.
  let currPath = '';
  const hasIndirectCycle = parent.some((token) => {
    currPath = `${currPath}/${escapeJsonPointerToken(token)}`;
    const safeCurrPath = normalizeAllOfPath(currPath);
    return (
      refs[safeCurrPath] &&
      refs[safeCurrPath].some(
        (ref) =>
          ref === fullyQualifiedPointer ||
          pointerIsAParent(ref, fullyQualifiedPointer) ||
          pointerIsAParent(fullyQualifiedPointer, ref)
      )
    );
  });
  if (hasIndirectCycle) {
    return true;
  }

  // No cycle, this ref will be resolved, so stores it now for future detection.
  // No need to store if has cycle, as parent path is a dead-end and won't be checked again.

  refs[safeParentPointer] = (refs[safeParentPointer] || []).concat(fullyQualifiedPointer);

  return undefined;
}

function normalizeAllOfPath(pointer) {
  const normalized = pointer.replace(/allOf\/\d+\/?/g, '');
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

/**
 * Checks if the value of this patch ends up pointing to an ancestor along the path.
 */
function patchValueAlreadyInPath(root, patch) {
  const ancestors = [root];
  patch.path.reduce((parent, p) => {
    ancestors.push(parent[p]);
    return parent[p];
  }, root);
  return pointToAncestor(patch.value);

  function pointToAncestor(obj) {
    return (
      lib.isObject(obj) &&
      (ancestors.indexOf(obj) >= 0 || Object.keys(obj).some((k) => pointToAncestor(obj[k])))
    );
  }
}
