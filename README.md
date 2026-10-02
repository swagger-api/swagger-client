# Swagger Client <img src="https://raw.githubusercontent.com/swagger-api/swagger.io/wordpress/images/assets/SW-logo-clr.png" height="50" align="right">

[![Build Status](https://github.com/swagger-api/swagger-client/actions/workflows/nodejs.yml/badge.svg)](https://github.com/swagger-api/swagger-client/actions)

**Swagger Client** is a JavaScript module that allows you to fetch, resolve, and interact with Swagger/OpenAPI documents.

## Table of Contents

 - [New](#new)
 - [Compatibility](#compatibility)
 - [Anonymized analytics](#anonymized-analytics)
 - [Documentation](#documentation)
  - [Usage](#usage)
  - [Development](#development)
  - [Migrations](#migrations)
 - [Runtime](#runtime)
  - [Node js](#nodejs)
  - [Browsers](#browsers)
 - [Security Contact](#security-contact)

## New!

**This is the new version of Swagger Client, 3.x.** The new version supports Swagger 2.0 as well as OpenAPI 3.

Want to learn more? Check out our [FAQ](docs/migration/migration-2-x-to-3-x.md).

For features known to be missing from 3.x please see the [Graveyard](docs/migration/graveyard-3-x.md).


For the older version of Swagger Client, refer to the [*2.x branch*](https://github.com/swagger-api/swagger-client/tree/2.x).

## Compatibility
The OpenAPI Specification has undergone multiple revisions since initial creation in 2010.
Compatibility between Swagger Client and the OpenAPI Specification is as follows:

Swagger Client Version | Release Date | OpenAPI Spec compatibility                              | Notes
------------------ |--------------|---------------------------------------------------------| -----
3.37.x | 2026-02-27    | 2.0, 3.0.0, 3.0.1, 3.0.2, 3.0.3, 3.0.4, 3.1.0, 3.2.0   | [tag v3.37.0](https://github.com/swagger-api/swagger-client/releases/tag/v3.37.0)
3.33.x | 2024-12-30   | 2.0, 3.0.0, 3.0.1, 3.0.2, 3.0.3, 3.0.4, 3.1.0           | [tag v3.33.0](https://github.com/swagger-api/swagger-client/releases/tag/v3.33.0)
3.19.x | 2023-01-23   | 2.0, 3.0.0, 3.0.1, 3.0.2, 3.0.3, 3.1.0                  | [tag v3.19.0-alpha.3](https://github.com/swagger-api/swagger-client/releases/tag/v3.19.0-alpha.3)
3.10.x | 2020-01-17   | 2.0, 3.0.0, 3.0.1, 3.0.2, 3.0.3                         | [tag v3.10.0](https://github.com/swagger-api/swagger-client/tree/v3.10.0)
2.1.32 | 2017-01-12   | 1.0, 1.1, 1.2                                           | [tag v2.1.32](https://github.com/swagger-api/swagger-client/tree/v2.1.32). This [release](https://github.com/swagger-api/swagger-client/releases/tag/v2.1.32) is only available on GitHub.

## Anonymized analytics

Swagger Client uses [Scarf](https://scarf.sh/) to collect [anonymized installation analytics](https://github.com/scarf-sh/scarf-js?tab=readme-ov-file#as-a-user-of-a-package-using-scarf-js-what-information-does-scarf-js-send-about-me). These analytics help support the maintainers of this library and ONLY run during installation. To [opt out](https://github.com/scarf-sh/scarf-js?tab=readme-ov-file#as-a-user-of-a-package-using-scarf-js-how-can-i-opt-out-of-analytics), you can set the `scarfSettings.enabled` field to `false` in your project's `package.json`:

```
// package.json
{
  // ...
  "scarfSettings": {
    "enabled": false
  }
  // ...
}
```

Alternatively, you can set the environment variable `SCARF_ANALYTICS` to `false` as part of the environment that installs your npm packages, e.g., `SCARF_ANALYTICS=false npm install`.

## Documentation

### Usage

- [Installation](docs/usage/installation.md)
- [Tags Interface](docs/usage/tags-interface.md)
- [HTTP client for OAS operations](docs/usage/http-client-for-oas-operations.md)
- [OpenAPI Definition Resolver](docs/usage/openapi-definition-resolver.md)
- [HTTP Client](docs/usage/http-client.md)
- [Swagger Client API](docs/usage/api.md)

### Development

- [Contributing](https://github.com/swagger-api/.github/blob/main/CONTRIBUTING.md)
- [Setting up](docs/development/setting-up.md)
- [Scripts](docs/development/scripts.md)

### Migrations 

- [Migration guide](docs/migration/migration-2-x-to-3-x.md)
- [Graveyard](docs/migration/graveyard-3-x.md)

## Runtime 

#### Node.js

`swagger-client` requires Node.js `>=22` and uses [native Node.js fetch](https://nodejs.org/dist/latest-v22.x/docs/api/globals.html#fetch).
Node.js `12`, `14`, `16`, `18`, and `20` are EOL and are no longer supported.

> NOTE: swagger-client minimum Node.js runtime version aligns with [Node.js Releases](https://nodejs.org/en/about/releases/)
> which means that we can drop support for **EOL** (End Of Life) Node.js versions without doing major version bump.

#### Browsers

`swagger-client` works in the latest versions of Chrome, Safari, Firefox, and Edge
and uses [native fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) implementation
provided by each supported browser.

## Security contact

Please disclose any security-related issues or vulnerabilities by emailing [security@swagger.io](mailto:security@swagger.io), instead of using the public issue tracker.
