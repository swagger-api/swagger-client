// This function runs after the common function,
// `src/execute/index.js#buildRequest`
import { isPlainObject } from 'ramda-adjunct';

import btoa from '../../helpers/btoa.node.js';

export default function buildRequest(options, req) {
  const { operation, requestBody, securities, spec, attachContentTypeForEmptyPayload } = options;

  let { requestContentType } = options;

  req = applySecurities({
    request: req,
    securities,
    operation,
    spec,
  });

  const requestBodyDef = operation.requestBody || {};
  const requestBodyMediaTypes = Object.keys(requestBodyDef.content || {});
  const isExplicitContentTypeValid =
    requestContentType && requestBodyMediaTypes.indexOf(requestContentType) > -1;

  // for OAS3: set the Content-Type
  if (requestBody || attachContentTypeForEmptyPayload) {
    // does the passed requestContentType appear in the requestBody definition?

    if (requestContentType && isExplicitContentTypeValid) {
      req.headers['Content-Type'] = requestContentType;
    } else if (!requestContentType) {
      const firstMediaType = requestBodyMediaTypes[0];
      if (firstMediaType) {
        req.headers['Content-Type'] = firstMediaType;
        requestContentType = firstMediaType;
      }
    }
  } else if (requestContentType && isExplicitContentTypeValid) {
    req.headers['Content-Type'] = requestContentType;
  }
  if (!options.responseContentType && operation.responses) {
    const mediaTypes = Object.entries(operation.responses)
      .filter(([key, value]) => {
        const code = parseInt(key, 10);
        return code >= 200 && code < 300 && isPlainObject(value.content);
      })
      .reduce((acc, [, value]) => acc.concat(Object.keys(value.content)), []);
    if (mediaTypes.length > 0) {
      req.headers.accept = mediaTypes.join(', ');
    }
  }

  // for OAS3: add requestBody to request
  if (requestBody) {
    if (requestContentType) {
      if (requestBodyMediaTypes.indexOf(requestContentType) > -1) {
        // only attach body if the requestBody has a definition for the
        // contentType that has been explicitly set
        if (
          requestContentType === 'application/x-www-form-urlencoded' ||
          requestContentType === 'multipart/form-data'
        ) {
          if (typeof requestBody === 'object') {
            const encoding = requestBodyDef.content[requestContentType]?.encoding ?? {};

            req.form = {};
            Object.keys(requestBody).forEach((k) => {
              let value = requestBody[k];
              try {
                const parsedValue = JSON.parse(value);
                // only objects and arrays need decoding; decoding primitives can
                // change the value (e.g. '1.0' becomes 1, big integers lose precision)
                if (typeof parsedValue === 'object' && parsedValue !== null) {
                  value = parsedValue;
                }
              } catch {
                // not a JSON string, keep the value as it is
              }
              req.form[k] = {
                value,
                encoding: encoding[k] || {},
              };
            });
          } else if (typeof requestBody === 'string') {
            const encoding = requestBodyDef.content[requestContentType]?.encoding ?? {};

            try {
              req.form = {};
              const form = JSON.parse(requestBody);
              Object.entries(form).forEach(([key, value]) => {
                req.form[key] = {
                  value,
                  encoding: encoding[key] || {},
                };
              });
            } catch {
              req.form = requestBody;
            }
          } else {
            req.form = requestBody;
          }
        } else {
          req.body = requestBody;
        }
      }
    } else {
      req.body = requestBody;
    }
  }

  return req;
}

// Add security values, to operations - that declare their need on them
// Adapted from the Swagger2 implementation
export function applySecurities({ request, securities = {}, operation = {}, spec }) {
  const result = { ...request };
  const { authorized = {} } = securities;
  const security = operation.security || spec.security || [];
  const isAuthorized = authorized && !!Object.keys(authorized).length;
  const securityDef = spec?.components?.securitySchemes || {};

  result.headers = result.headers || {};
  result.query = result.query || {};

  if (
    !Object.keys(securities).length ||
    !isAuthorized ||
    !security ||
    (Array.isArray(operation.security) && !operation.security.length)
  ) {
    return request;
  }

  security.forEach((securityObj) => {
    Object.keys(securityObj).forEach((key) => {
      const auth = authorized[key];
      const schema = securityDef[key];

      if (!auth) {
        return;
      }

      const value = auth.value || auth;
      const { type } = schema;

      if (auth) {
        if (type === 'apiKey') {
          if (schema.in === 'query') {
            result.query[schema.name] = value;
          }
          if (schema.in === 'header') {
            result.headers[schema.name] = value;
          }
          if (schema.in === 'cookie') {
            result.cookies[schema.name] = value;
          }
        } else if (type === 'http') {
          if (/^basic$/i.test(schema.scheme)) {
            const username = value.username || '';
            const password = value.password || '';
            const encoded = btoa(`${username}:${password}`);
            result.headers.Authorization = `Basic ${encoded}`;
          }

          if (/^bearer$/i.test(schema.scheme)) {
            result.headers.Authorization = `Bearer ${value}`;
          }
        } else if (type === 'oauth2' || type === 'openIdConnect') {
          const token = auth.token || {};
          const tokenName = schema['x-tokenName'] || 'access_token';
          const tokenValue = token[tokenName];
          let tokenType = token.token_type;

          if (!tokenType || tokenType.toLowerCase() === 'bearer') {
            tokenType = 'Bearer';
          }

          result.headers.Authorization = `${tokenType} ${tokenValue}`;
        }
      }
    });
  });

  return result;
}
