import { resolve as resolvePathTemplate } from 'openapi-path-templating';

import stylize, { encodeCharacters } from './style-serializer.js';
import serialize from './content-serializer.js';
import { serialize as serializeCookie } from '../../helpers/cookie.js';

export function path({ req, value, parameter, baseURL }) {
  const { name, style, explode, content } = parameter;

  if (value === undefined) return;

  const pathname = req.url.replace(baseURL, '');
  let resolvedPathname;

  if (content) {
    const effectiveMediaType = Object.keys(content)[0];

    resolvedPathname = resolvePathTemplate(
      pathname,
      { [name]: value },
      { encoder: (val) => encodeCharacters(serialize(val, effectiveMediaType)) }
    );
  } else {
    resolvedPathname = resolvePathTemplate(
      pathname,
      { [name]: value },
      {
        encoder: (val) =>
          stylize({
            key: parameter.name,
            value: val,
            style: style || 'simple',
            explode: explode ?? false,
            escape: 'reserved',
          }),
      }
    );
  }

  req.url = baseURL + resolvedPathname;
}

export function query({ req, value, parameter }) {
  req.query = req.query || {};

  if (value !== undefined && parameter.content) {
    const effectiveMediaType = Object.keys(parameter.content)[0];
    const serializedValue = serialize(value, effectiveMediaType);

    if (serializedValue) {
      req.query[parameter.name] = serializedValue;
    } else if (parameter.allowEmptyValue) {
      const paramName = parameter.name;
      req.query[paramName] = req.query[paramName] || {};
      req.query[paramName].allowEmptyValue = true;
    }

    return;
  }

  if (value === false) {
    value = 'false';
  }

  if (value === 0) {
    value = '0';
  }

  if (value) {
    const { style, explode, allowReserved } = parameter;
    req.query[parameter.name] = {
      value,
      serializationOption: { style, explode, allowReserved },
    };
  } else if (parameter.allowEmptyValue && value !== undefined) {
    const paramName = parameter.name;
    req.query[paramName] = req.query[paramName] || {};
    req.query[paramName].allowEmptyValue = true;
  }
}

const PARAMETER_HEADER_BLACKLIST = ['accept', 'authorization', 'content-type'];

export function header({ req, parameter, value }) {
  req.headers = req.headers || {};

  if (PARAMETER_HEADER_BLACKLIST.indexOf(parameter.name.toLowerCase()) > -1) {
    return;
  }

  if (value !== undefined && parameter.content) {
    const effectiveMediaType = Object.keys(parameter.content)[0];

    req.headers[parameter.name] = serialize(value, effectiveMediaType);
    return;
  }

  if (value !== undefined && !(Array.isArray(value) && value.length === 0)) {
    req.headers[parameter.name] = stylize({
      key: parameter.name,
      value,
      style: parameter.style || 'simple',
      explode: typeof parameter.explode === 'undefined' ? false : parameter.explode,
      escape: false,
    });
  }
}

const appendCookie = (req, cookieString) => {
  req.headers.Cookie = req.headers.Cookie ? `${req.headers.Cookie}; ${cookieString}` : cookieString;
};

export function cookie({ req, parameter, value }) {
  const { name: cookieName } = parameter;

  req.headers = req.headers || {};

  if (value !== undefined && parameter.content) {
    const effectiveMediaType = Object.keys(parameter.content)[0];
    const cookieValue = serialize(value, effectiveMediaType);

    appendCookie(req, serializeCookie({ [cookieName]: cookieValue }));
    return;
  }

  if (value !== undefined && !(Array.isArray(value) && value.length === 0)) {
    const serializedValue = stylize({
      key: parameter.name,
      value,
      escape: false,
      style: parameter.style || 'form',
      explode: parameter.explode ?? false,
    });
    const cookieValue =
      Array.isArray(value) && parameter.explode
        ? `${cookieName}=${serializedValue}`
        : serializedValue;

    appendCookie(req, serializeCookie({ [cookieName]: cookieValue }));
  }
}
