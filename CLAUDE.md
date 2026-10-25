# CLAUDE.md - AI Assistant Guide for swagger-client

This document provides comprehensive guidance for AI assistants working on the swagger-client codebase.

## Project Overview

**swagger-client** is a JavaScript module that allows you to fetch, resolve, and interact with Swagger/OpenAPI documents. It supports:
- OpenAPI 3.2.0 (latest)
- OpenAPI 3.1.0
- OpenAPI 3.0.x (3.0.0 through 3.0.4)
- Swagger/OpenAPI 2.0
- Legacy Swagger 1.x (via version 2.x branch)

**Current Version**: 3.36.0

The library is used by Swagger-UI and other tools in the OpenAPI ecosystem to parse, resolve references, and execute operations defined in OpenAPI specifications.

## Repository Structure

```
swagger-client/
├── src/                    # Source code (ES6+ modules)
│   ├── execute/           # Request execution logic for OAS operations
│   │   ├── oas3/         # OpenAPI 3.x execution
│   │   └── swagger2/     # Swagger 2.0 execution
│   ├── helpers/          # Utility functions and helpers
│   ├── http/             # HTTP client implementation
│   │   └── serializers/  # Request/response serialization
│   ├── resolver/         # Spec resolution and $ref handling
│   │   ├── apidom/       # ApiDOM-based resolution (OAS 3.1)
│   │   ├── specmap/      # Legacy spec resolution engine
│   │   └── strategies/   # Version-specific resolution strategies
│   ├── subtree-resolver/ # Partial spec resolution
│   ├── index.js          # Main entry point
│   ├── interfaces.js     # Tags interface generation
│   ├── constants.js      # Global constants
│   └── commonjs.js       # CommonJS entry point
├── test/                  # Test suite
│   ├── bugs/             # Bug reproduction tests
│   ├── data/             # Test fixtures and sample specs
│   ├── execute/          # Execution tests
│   ├── helpers/          # Helper function tests
│   ├── http/             # HTTP client tests
│   ├── oas3/             # OpenAPI 3.x specific tests
│   ├── swagger2/         # Swagger 2.0 specific tests
│   ├── resolver/         # Resolution tests
│   └── build-artifacts/  # Build output verification tests
├── config/               # Build and test configuration
│   ├── jest/            # Jest test configurations
│   └── webpack/         # Webpack build configurations
├── docs/                 # Documentation
│   ├── usage/           # Usage documentation
│   ├── development/     # Development guides
│   └── migration/       # Migration guides
├── lib/                  # Built CommonJS output (gitignored)
├── es/                   # Built ES modules output (gitignored)
├── dist/                 # Built browser UMD bundle (gitignored)
└── .github/              # GitHub configuration
    └── workflows/       # CI/CD workflows
```

## Technology Stack

### Core Technologies
- **Language**: JavaScript (ES6+)
- **Build Tools**: Babel, Webpack
- **Test Framework**: Jest
- **Module Formats**: CommonJS, ES Modules, UMD (browser)

### Key Dependencies
- **@swagger-api/apidom-\***: ApiDOM suite for OpenAPI 3.1 parsing and resolution
- **ramda**: Functional programming utilities
- **js-yaml**: YAML parsing
- **deepmerge**: Deep object merging
- **fast-json-patch**: JSON Patch operations
- **node-abort-controller**: AbortController polyfill for Node.js
- **openapi-path-templating**: Path parameter templating
- **openapi-server-url-templating**: Server URL templating

### Development Dependencies
- **eslint**: Code linting (Airbnb base config)
- **prettier**: Code formatting
- **commitlint**: Commit message validation
- **husky**: Git hooks
- **lint-staged**: Pre-commit linting

## Build System

The project uses Babel for transpilation and Webpack for browser bundling.

### Build Targets
1. **UMD Browser Bundle** (`dist/swagger-client.browser.min.js`)
   - For `<script>` tag inclusion
   - Includes all polyfills
   - Minified and source-mapped

2. **CommonJS** (`lib/`)
   - ES5 code with CommonJS `require`/`module.exports`
   - For Node.js and older bundlers

3. **ES Modules** (`es/`)
   - ES5 code with ES6 `import`/`export`
   - For modern bundlers and tree-shaking

### Babel Configuration
The project uses environment-specific Babel configurations (see `babel.config.js`):
- `BABEL_ENV=commonjs`: CommonJS output
- `BABEL_ENV=es`: ES modules output
- `BABEL_ENV=browser`: Browser UMD bundle

### Browser/Node Polyfills
The project uses conditional imports for platform-specific code:
- `btoa.node.js` vs `btoa.browser.js`
- `fetch-polyfill.node.js` vs `fetch-polyfill.browser.js`
- `abortcontroller-polyfill.node.js` vs `abortcontroller-polyfill.browser.js`

These are configured in `package.json` under the `browser` field.

## Development Workflow

### Setup
```bash
# Use correct Node.js version (see .nvmrc)
nvm use

# Install dependencies
npm install

# Build all targets
npm run build

# Run tests
npm test
```

### Node.js Requirements
- **Development**: Node.js >= 22.11.0, npm >= 10.9.0
- **Runtime Support**: Node.js >= 22
- **Note**: EOL Node.js versions may be dropped without major version bump

### Available Scripts
- `npm run lint`: Check for linting errors
- `npm run lint:fix`: Auto-fix linting errors
- `npm run build`: Build all targets (UMD, CommonJS, ES)
- `npm run build:umd:browser`: Build browser bundle only
- `npm run build:commonjs`: Build CommonJS only
- `npm run build:es`: Build ES modules only
- `npm test`: Run all tests (unit + artifact tests)
- `npm run test:unit`: Run unit tests
- `npm run test:unit:watch`: Run tests in watch mode
- `npm run test:unit:coverage`: Run tests with coverage
- `npm run test:artifact`: Test build outputs
- `npm run clean`: Remove all build outputs
- `npm run analyze:umd:browser`: Analyze browser bundle size

### Git Hooks
The project uses Husky for Git hooks:
- **pre-commit**: Runs `lint-staged` to lint and format staged files
- **commit-msg**: Validates commit message format with commitlint

### Commit Message Format
Follows [Conventional Commits](https://www.conventionalcommits.org/):
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Rules** (from `.commitlintrc.json`):
- Max header length: 69 characters
- Type: Required (e.g., feat, fix, docs, test, chore, refactor)
- Scope: Optional, camelCase/kebab-case/UPPER_CASE
- Subject: Required, any case

**Examples**:
```
feat(resolver): add support for OpenAPI 3.1 webhooks
fix(http): handle empty response bodies correctly
docs(README): update installation instructions
test(execute): add test for parameter serialization
chore(deps): bump @swagger-api/apidom-core to 1.0.0
```

## Testing Strategy

### Test Structure
- **Unit Tests**: Test individual functions and modules
- **Artifact Tests**: Verify that built outputs work correctly
- **Integration Tests**: Test full workflows (resolve → execute)

### Jest Configuration
Multiple Jest configs for different test scenarios:
- `jest.unit.config.js`: Fast unit tests
- `jest.unit.coverage.config.js`: Unit tests with coverage reporting
- `jest.artifact-umd-browser.config.js`: Test browser UMD bundle
- `jest.artifact-commonjs.config.js`: Test CommonJS build
- `jest.artifact-es.config.js`: Test ES modules build

### Test Conventions
- Test files mirror source structure: `src/foo/bar.js` → `test/foo/bar.js`
- Use descriptive test names
- Mock external dependencies (HTTP requests, file system)
- Use fixture files in `test/data/` for OpenAPI specs

### Running Specific Tests
```bash
# Run specific test file
npm run test:unit -- path/to/test.js

# Run tests matching pattern
npm run test:unit -- --testNamePattern="resolver"

# Run with coverage
npm run test:unit:coverage
```

## Code Style and Conventions

### ESLint Configuration
- **Base Config**: Airbnb JavaScript Style Guide
- **Parser**: @babel/eslint-parser
- **Extensions**: Prettier integration

### Key Rules
- **Import Order**: Grouped and sorted (builtin/external/internal, then parent/sibling/index)
- **Import Extensions**: Always include `.js` extension in imports
- **No Param Reassign**: Temporarily disabled (marked for future fix)
- **No Use Before Define**: Functions only (marked for future fix)

### Prettier Configuration
From `.prettierrc`:
```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5"
}
```

### Code Style Guidelines
1. **Imports**: Always use `.js` extensions
   ```javascript
   import foo from './foo.js';  // ✓ Correct
   import foo from './foo';     // ✗ Wrong
   ```

2. **Import Groups**: Maintain separation between external and internal imports
   ```javascript
   // External dependencies
   import ramda from 'ramda';
   import yaml from 'js-yaml';

   // Internal modules
   import { makeHttp } from './http/index.js';
   import { opId } from './helpers/index.js';
   ```

3. **Exports**: Use named exports, default export for main entry
   ```javascript
   // Named exports
   export const resolve = () => {};
   export const execute = () => {};

   // Default export for main module
   export default Swagger;
   ```

4. **Async/Await**: Prefer async/await over raw Promises
   ```javascript
   // ✓ Preferred
   async function resolve(spec) {
     const result = await http.fetch(spec.url);
     return result;
   }

   // ✗ Avoid (unless chaining is cleaner)
   function resolve(spec) {
     return http.fetch(spec.url).then(result => result);
   }
   ```

## Architecture Overview

### Main Entry Point
`src/index.js` exports the main `Swagger` constructor function with attached methods:
- `Swagger()`: Main constructor, returns a promise
- `Swagger.resolve()`: Resolve an OpenAPI spec (handle $refs, normalize)
- `Swagger.execute()`: Execute an operation
- `Swagger.buildRequest()`: Build a request object without executing
- `Swagger.http`: HTTP client
- `Swagger.helpers`: Helper utilities

### Core Modules

#### 1. Resolver (`src/resolver/`)
Handles $ref resolution and spec normalization. Uses different strategies based on OpenAPI version:

**Resolution Strategies**:
- `openapi-3-2-apidom`: Uses ApiDOM library for OpenAPI 3.2 (most modern)
- `openapi-3-1-apidom`: Uses ApiDOM library for OpenAPI 3.1
- `openapi-3-0`: Custom resolver for OpenAPI 3.0.x
- `openapi-2-0`: Custom resolver for Swagger 2.0
- `generic`: Fallback for unknown specs

**Strategy Selection** (in `src/resolver/index.js`):
Strategies are tried in order until one matches. ApiDOM is preferred for OAS 3.1.

**SpecMap** (`src/resolver/specmap/`):
Legacy resolution engine used by non-ApiDOM strategies. Handles:
- `$ref` resolution
- `allOf` merging
- Parameter normalization
- Property resolution

#### 2. Executor (`src/execute/`)
Builds and executes HTTP requests based on OpenAPI operations.

**Version-Specific Logic**:
- `execute/swagger2/`: Swagger 2.0 parameter handling, security
- `execute/oas3/`: OpenAPI 3.x parameter styles, security, requestBody

**Key Functions**:
- `execute()`: Full execution (build + send request)
- `buildRequest()`: Build request object only
- `baseUrl()`: Determine base URL from spec

#### 3. HTTP Client (`src/http/`)
Abstraction over fetch API with interceptors.

**Features**:
- Request/response interceptors
- Automatic serialization
- Cookie handling
- Abort controller support

**Serializers** (`src/http/serializers/`):
- Request serializers: body, headers, query parameters
- Response serializers: parse response, extract headers

#### 4. Interfaces (`src/interfaces.js`)
Generates convenient tag-based and operationId-based interfaces:
```javascript
const client = await Swagger('https://petstore.swagger.io/v2/swagger.json');

// Tag-based interface
client.apis.pet.addPet({ body: petData });

// OperationId-based interface
client.apis.addPet({ body: petData });
```

### Key Patterns

#### Resolution Strategy Pattern
Multiple resolution strategies that implement a common interface:
```javascript
{
  match: (spec) => boolean,        // Can this strategy handle this spec?
  resolve: (options) => Promise,   // Resolve the spec
}
```

#### HTTP Interceptors
Request and response interceptors for customization:
```javascript
const client = await Swagger({
  url: 'https://api.example.com/spec.json',
  requestInterceptor: (req) => {
    req.headers.Authorization = 'Bearer token';
    return req;
  },
  responseInterceptor: (res) => {
    console.log('Response:', res);
    return res;
  },
});
```

#### Browser vs Node Conditionals
Platform-specific imports configured in `package.json`:
```javascript
// In source code
import btoa from './helpers/btoa.node.js';

// In browser, webpack resolves to
import btoa from './helpers/btoa.browser.js';
```

## Common Tasks and Patterns

### Adding an OpenAPI Version or a JSON Schema Dialect

Use the skills in `.claude/skills/` (`.claude/skills/README.md` explains them): `/add-oas-support`
for a new OpenAPI version, `/add-json-schema-support` for resolving standalone JSON Schema
documents, `/review-spec-support` to review either.

### Adding Support for New OpenAPI Features

1. **Identify the OpenAPI version** (2.0, 3.0, 3.1, 3.2)
2. **Update the appropriate resolver strategy**:
   - OAS 3.2: `src/resolver/strategies/openapi-3-2-apidom/`
   - OAS 3.1: `src/resolver/strategies/openapi-3-1-apidom/`
   - OAS 3.0: `src/resolver/strategies/openapi-3-0/`
   - OAS 2.0: `src/resolver/strategies/openapi-2/`
3. **Update execution logic** if feature affects operations:
   - `src/execute/oas3/` or `src/execute/swagger2/`
4. **Add tests** in corresponding test directory
5. **Update documentation** in `docs/`

### Fixing a Bug

1. **Write a failing test** in `test/bugs/` that reproduces the issue
2. **Identify the affected module**
3. **Fix the bug** in source code
4. **Verify the test passes**
5. **Run full test suite**: `npm test`
6. **Check linting**: `npm run lint`
7. **Commit with proper format**: `fix(module): description`

### Adding a New Dependency

1. **Install dependency**: `npm install <package>`
2. **Update imports** with `.js` extension
3. **Consider browser compatibility**
4. **Update `package.json` browser field** if needed for polyfills
5. **Test all build targets**: `npm run test:artifact`
6. **Check bundle size**: `npm run analyze:umd:browser`

### Refactoring Code

1. **Run tests first**: `npm test` (ensure baseline)
2. **Make incremental changes**
3. **Run tests after each change**
4. **Update imports** if moving files
5. **Check for breaking changes** in public API
6. **Run lint**: `npm run lint:fix`
7. **Commit with**: `refactor(module): description`

## CI/CD Pipeline

### GitHub Actions Workflow
File: `.github/workflows/nodejs.yml`

**Main Build Job** (runs on Node.js 22, 24):
1. Checkout code
2. Setup Node.js
3. Cache node_modules
4. Install dependencies (`npm ci`)
5. Lint commit message (commitlint)
6. Lint code (`npm run lint`)
7. Run tests (`npm test`)
8. Build (`npm run build`)
9. Upload build artifacts (Node 22 only)

**Artifact Test Job**:
Tests CommonJS build on Node.js 22.x

**Other Workflows**:
- `codeql.yml`: Security analysis with CodeQL
- `release.yml`: Automated releases
- `dependabot-merge.yml`: Auto-merge Dependabot PRs

### Pull Request Requirements
All PRs must pass:
- ✓ Linting (ESLint)
- ✓ Commit message format (commitlint)
- ✓ Unit tests
- ✓ Artifact tests
- ✓ Build succeeds

## Important Files Reference

### Configuration Files
- `package.json`: Dependencies, scripts, build config, browser field
- `babel.config.js`: Babel transpilation config (multi-environment)
- `.eslintrc.js`: ESLint rules
- `.prettierrc`: Prettier formatting rules
- `.commitlintrc.json`: Commit message validation
- `.browserslistrc`: Browser targets for Babel
- `.editorconfig`: Editor settings
- `.nvmrc`: Node.js version (22)
- `.lintstagedrc`: Lint-staged configuration

### Source Files
- `src/index.js`: Main entry point, Swagger constructor
- `src/commonjs.js`: CommonJS entry point
- `src/constants.js`: Global constants (e.g., DEFAULT_OPENAPI_3_SERVER)
- `src/interfaces.js`: Tag and operationId interface generation
- `src/resolver/index.js`: Resolver factory, strategy selection
- `src/execute/index.js`: Execution engine
- `src/http/index.js`: HTTP client

### Documentation
- `README.md`: Project overview, installation, basic usage
- `docs/usage/`: User-facing documentation
- `docs/development/`: Developer guides
- `docs/migration/`: Migration guides between versions

### Build Output (gitignored)
- `lib/`: CommonJS build
- `es/`: ES modules build
- `dist/`: Browser UMD bundle
- `coverage/`: Test coverage reports

## Tips for AI Assistants

### When Analyzing Code
1. **Check OpenAPI version context**: Different logic for 2.0 vs 3.0 vs 3.1
2. **Understand resolution vs execution**: Separate concerns
3. **Look for version-specific paths**: `swagger2/` vs `oas3/` directories
4. **Check for browser polyfills**: Platform-specific imports

### When Making Changes
1. **Always run tests**: `npm test` before and after changes
2. **Check all build targets**: UMD, CommonJS, and ES modules
3. **Maintain import conventions**: Include `.js` extensions
4. **Follow existing patterns**: Especially for strategy implementations
5. **Update tests**: Add tests for new functionality
6. **Check browser compatibility**: Test UMD bundle if affecting browser code
7. **Lint before committing**: `npm run lint:fix`

### When Debugging
1. **Check resolver strategy**: Which strategy is handling the spec?
2. **Inspect intermediate state**: Look at resolved spec before execution
3. **Review test fixtures**: `test/data/` has example specs
4. **Use unit tests**: Write minimal reproduction in test
5. **Check HTTP layer**: Use requestInterceptor to debug requests

### When Writing Tests
1. **Use descriptive names**: `test('should resolve $ref in parameters', ...)`
2. **Isolate tests**: Mock HTTP, file system
3. **Use fixtures**: Reuse specs from `test/data/`
4. **Test edge cases**: Empty specs, missing fields, invalid refs
5. **Check multiple OAS versions**: Test 2.0, 3.0, and 3.1 if applicable

### Common Pitfalls
1. **Forgetting `.js` extensions**: Will fail ESLint
2. **Breaking browser builds**: Test with `npm run test:artifact:umd:browser`
3. **Mutating parameters**: Avoid (see ESLint rules)
4. **Missing import grouping**: ESLint enforces order
5. **Commit message format**: Use conventional commits
6. **Not testing all Node versions**: CI tests 16, 18, 20, 22

## Related Repositories

- **swagger-ui**: Main consumer of this library
  - Repo: https://github.com/swagger-api/swagger-ui
  - Link testing instructions: `docs/development/setting-up.md`

- **@swagger-api/apidom**: ApiDOM suite for OpenAPI 3.1
  - Used by `openapi-3-1-apidom` resolver strategy
  - Multiple packages: core, reference, parsers, etc.

## Security

- Report security issues to: security@swagger.io
- Do not use public issue tracker for security vulnerabilities
- See `.github/SECURITY.md` for details

## License

Apache 2.0 (see `LICENSE` file)

## Maintainers

See `package.json` contributors list and GitHub contributors page.

---

**Last Updated**: 2026-01-22
**swagger-client Version**: 3.36.0
**Node.js Version**: 22.11.0+
