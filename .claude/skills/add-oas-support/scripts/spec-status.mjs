#!/usr/bin/env node
/**
 * Reports which pieces of OpenAPI or standalone JSON Schema support exist in swagger-client and
 * in the ApiDOM packages it consumes. Every check reads files in this repository or its
 * node_modules; nothing is fetched.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { parseCli } from './lib/cli.mjs';

// $schema URIs from https://json-schema.org/specification-links; `pkg` is the ApiDOM package
// suffix (apidom-ns-json-schema-<pkg>), `exports` the suffix of the names in `Swagger.apidom`.
const DIALECTS = {
  '2020-12': {
    uri: 'https://json-schema.org/draft/2020-12/schema',
    pkg: '2020-12',
    compact: '202012',
    exports: '2020_12',
  },
  '2019-09': {
    uri: 'https://json-schema.org/draft/2019-09/schema',
    pkg: '2019-09',
    compact: '201909',
    exports: '2019_09',
  },
  'draft-07': {
    uri: 'http://json-schema.org/draft-07/schema#',
    pkg: 'draft-7',
    compact: 'Draft7',
    exports: 'Draft7',
  },
  'draft-06': {
    uri: 'http://json-schema.org/draft-06/schema#',
    pkg: 'draft-6',
    compact: 'Draft6',
    exports: 'Draft6',
  },
  'draft-04': {
    uri: 'http://json-schema.org/draft-04/schema#',
    pkg: 'draft-4',
    compact: 'Draft4',
    exports: 'Draft4',
  },
};

const USAGE = `
Usage:
  node spec-status.mjs --oas <major.minor> [--parent <major.minor>]
  node spec-status.mjs --json-schema <${Object.keys(DIALECTS).join('|')}>

  --oas          OpenAPI version line, e.g. 3.3
  --parent       previous OpenAPI line (default: minor - 1); the unwired-file scan compares
                 against it
  --json-schema  JSON Schema dialect for standalone documents
  --root         repository root (default: current directory)
  -h, --help     show this help

Statuses:
  OK        present
  MISSING   required and absent
  UPSTREAM  absent in an installed ApiDOM package: the swagger-client work can't start
  DECIDE    a file names the parent version but not the new one, or a test of the parent has no
            counterpart: wire or mirror it, or record in the tracking doc why not
  NOTE      information

Exit codes: 0 no MISSING/UPSTREAM, 1 MISSING, 3 UPSTREAM (takes precedence), 2 usage error.
`;

const { values } = parseCli(USAGE, {
  options: {
    oas: { type: 'string' },
    parent: { type: 'string' },
    'json-schema': { type: 'string' },
    root: { type: 'string', default: '.' },
  },
  validate: ({ values: v }) => {
    if ([v.oas, v['json-schema']].filter(Boolean).length !== 1)
      return 'exactly one of --oas or --json-schema is required';
    if (v.oas && !/^\d+\.\d+$/.test(v.oas)) return '--oas takes <major.minor>, e.g. 3.3';
    if (v.parent && !v.oas) return '--parent goes with --oas';
    if (v.parent && !/^\d+\.\d+$/.test(v.parent)) return '--parent takes <major.minor>';
    if (v['json-schema'] && !DIALECTS[v['json-schema']])
      return `unknown dialect ${v['json-schema']}`;
    if (!existsSync(join(v.root, 'src/resolver/strategies')))
      return `${v.root} is not a swagger-client checkout`;
    return undefined;
  },
});

const ROOT = values.root;
const results = [];
const report = (status, area, message) => results.push({ status, area, message });
const check = (condition, area, okMessage, missing, status = 'MISSING') =>
  report(condition ? 'OK' : status, area, condition ? okMessage : missing);

const path = (...segments) => join(ROOT, ...segments);
const read = (...segments) => {
  const file = path(...segments);
  return existsSync(file) && statSync(file).isFile() ? readFileSync(file, 'utf8') : '';
};
const rel = (file) => relative(ROOT, file);
const walk = (dir, filter) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full, filter);
    return filter(full) ? [full] : [];
  });
};
const pkg = JSON.parse(read('package.json') || '{}');
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------------------------------------------------------------------ */
/* Shared                                                                                     */
/* ------------------------------------------------------------------------------------------ */

const checkUpstream = (namespace, strategy, label) => {
  if (!existsSync(path('node_modules/@swagger-api'))) {
    report('UPSTREAM', 'upstream', `node_modules is missing: run npm ci, then re-run (${label})`);
    return;
  }
  check(
    existsSync(path('node_modules/@swagger-api', namespace)),
    'upstream',
    `@swagger-api/${namespace} is installed`,
    `@swagger-api/${namespace} isn't installed: ApiDOM phase 1 for ${label}, or bump ApiDOM`,
    'UPSTREAM'
  );
  ['resolve', 'dereference'].forEach((kind) =>
    check(
      existsSync(path('node_modules/@swagger-api/apidom-reference/src', kind, 'strategies', strategy)),
      'upstream',
      `apidom-reference has the ${strategy} ${kind} strategy`,
      `apidom-reference has no ${strategy} ${kind} strategy: ApiDOM phase 3 for ${label}`,
      'UPSTREAM'
    )
  );
};

/**
 * Both default strategy arrays in src/index.js (resolve and resolveSubtree) must list the new
 * strategy, ahead of `before` (the parent version's strategy, or the generic one).
 */
const checkStrategyArrays = (key, before) => {
  const index = read('src/index.js');
  check(
    index.includes(`'${key}': `),
    'wiring',
    `src/index.js registers Swagger.resolveStrategies['${key}']`,
    `src/index.js has no Swagger.resolveStrategies['${key}']`
  );
  // The arrays close on a line of their own; `]` inside resolveStrategies['...'] doesn't end one.
  const arrays = [...index.matchAll(/strategies: \[([\s\S]*?)\n\s*\]/g)].map((m) => m[1]);
  const ordered = arrays.filter((block) => {
    const at = block.indexOf(`'${key}'`);
    return at !== -1 && at < block.indexOf(before);
  });
  check(
    arrays.length >= 2 && ordered.length === arrays.length,
    'wiring',
    `both default strategy arrays in src/index.js list '${key}' before ${before}`,
    `${arrays.length - ordered.length} of ${arrays.length} strategy arrays in src/index.js lack '${key}' before ${before} (resolve and resolveSubtree each need it)`
  );
};

const checkEslint = (strategy) => {
  const eslint = read('.eslintrc.js');
  ['resolve', 'dereference'].forEach((kind) =>
    check(
      eslint.includes(`apidom-reference/${kind}/strategies/${strategy}$`),
      'wiring',
      `.eslintrc.js allows apidom-reference/${kind}/strategies/${strategy}`,
      `.eslintrc.js import/no-unresolved ignore lacks apidom-reference/${kind}/strategies/${strategy}`
    )
  );
};

const checkFiles = (area, files) =>
  files.forEach((file) =>
    check(existsSync(path(file)), area, `${file} exists`, `${file} is missing`)
  );

const checkDependency = (name) => {
  check(
    Boolean(pkg.dependencies?.[name]),
    'deps',
    `${name} is in dependencies`,
    `${name} isn't in dependencies (src imports it)`
  );
  check(
    (pkg.scripts?.['link:apidom'] ?? '').includes(name),
    'deps',
    `the link:apidom script links ${name}`,
    `the link:apidom script doesn't link ${name}`
  );
};

const checkApiDOMVersions = () => {
  const versions = new Set(
    Object.entries({ ...pkg.dependencies, ...pkg.optionalDependencies })
      .filter(([name]) => name.startsWith('@swagger-api/apidom-'))
      .map(([, version]) => version)
  );
  check(
    versions.size <= 1,
    'deps',
    `every @swagger-api/apidom-* package is on ${[...versions][0] ?? '(none)'}`,
    `@swagger-api/apidom-* packages are on ${versions.size} versions (${[...versions].join(', ')}): two copies of apidom-core end up in the bundle`
  );
};

/**
 * Parity of tests with the parent: every file under the parent's test folders has a counterpart
 * under the new version's folders (fixtures and snapshots included). A gap is a DECIDE: mirror
 * the files, or record in the tracking doc why the new version doesn't need them.
 */
const checkTestParity = (pairs) =>
  pairs.forEach(([parentDir, newDir]) => {
    const parentFiles = walk(path(parentDir), () => true).map((file) =>
      relative(path(parentDir), file)
    );
    if (parentFiles.length === 0) return;
    const missing = parentFiles.filter(
      (file) => !existsSync(path(newDir, file.replace(/__snapshots__\/.*/, '__snapshots__')))
    );
    check(
      missing.length === 0,
      'tests',
      `${newDir} mirrors all ${parentFiles.length} files of ${parentDir}`,
      `${newDir} lacks ${missing.length} of ${parentFiles.length} files of ${parentDir}: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', ...' : ''} (mirror them or record why not)`,
      'DECIDE'
    );
  });

/* ------------------------------------------------------------------------------------------ */
/* OpenAPI                                                                                    */
/* ------------------------------------------------------------------------------------------ */

const oasNames = (version) => {
  const [major, minor] = version.split('.');
  return {
    version,
    major,
    minor,
    dashed: `${major}-${minor}`, // openapi-3-2-apidom
    compact: `${major}${minor}`, // isOpenAPI32
    underscored: `${major}_${minor}`, // OpenApiJson3_2Parser
  };
};

// Every spelling of a version that names it in code: isOpenAPI32, OpenApi3_2Element,
// OpenAPIJSON3_2Parser, openapi-3-2-apidom, openapi-json-3-2, apidom-ns-openapi-3-2.
const versionPattern = (n) =>
  new RegExp(
    `OpenAPI${n.compact}(?!\\d)|Open(?:API|Api)(?:JSON|YAML|Json|Yaml)?${n.underscored}(?!\\d)|openapi-(?:json-|yaml-)?${n.dashed}(?![\\d.])`
  );

const checkOpenAPIUpstream = (n) =>
  checkUpstream(`apidom-ns-openapi-${n.dashed}`, `openapi-${n.dashed}`, `OpenAPI ${n.version}`);

const checkOpenAPIWiring = (n, p) => {
  const predicates = read('src/helpers/openapi-predicates.js');
  check(
    predicates.includes(`export const isOpenAPI${n.compact} `),
    'wiring',
    `src/helpers/openapi-predicates.js exports isOpenAPI${n.compact}`,
    `src/helpers/openapi-predicates.js has no isOpenAPI${n.compact}`
  );
  if (n.major === '3') {
    const aggregate = predicates.match(/export const isOpenAPI3 = [^;]*;/)?.[0] ?? '';
    check(
      aggregate.includes(`isOpenAPI${n.compact}(spec)`),
      'wiring',
      `isOpenAPI3 includes isOpenAPI${n.compact} (execute, interfaces)`,
      `isOpenAPI3 doesn't include isOpenAPI${n.compact}: execute and interfaces treat ${n.version} as non-OAS3`
    );
  }

  const strategyDir = `src/resolver/strategies/openapi-${n.dashed}-apidom`;
  checkFiles('wiring', [
    `${strategyDir}/index.js`,
    `${strategyDir}/resolve.js`,
    `${strategyDir}/normalize.js`,
    `src/resolver/apidom/reference/parse/parsers/openapi-json-${n.dashed}/index.js`,
    `src/resolver/apidom/reference/parse/parsers/openapi-yaml-${n.dashed}/index.js`,
    `src/resolver/apidom/reference/dereference/strategies/openapi-${n.dashed}-swagger-client/index.js`,
    `src/resolver/apidom/reference/dereference/strategies/openapi-${n.dashed}-swagger-client/visitors/root.js`,
    `src/resolver/apidom/reference/dereference/strategies/openapi-${n.dashed}-swagger-client/visitors/dereference.js`,
  ]);
  const strategy = read(strategyDir, 'index.js');
  if (strategy)
    check(
      strategy.includes(`name: 'openapi-${n.dashed}-apidom'`) &&
        strategy.includes(`isOpenAPI${n.compact}(`),
      'wiring',
      `${strategyDir}/index.js is named openapi-${n.dashed}-apidom and matches isOpenAPI${n.compact}`,
      `${strategyDir}/index.js still carries another version's name or predicate`
    );
  const resolve = read(strategyDir, 'resolve.js');
  if (resolve)
    check(
      !(p && versionPattern(p).test(resolve)) && versionPattern(n).test(resolve),
      'wiring',
      `${strategyDir}/resolve.js uses only ${n.version} parsers, element and strategies`,
      `${strategyDir}/resolve.js still imports ${p?.version ?? 'another version'}'s parsers, element or strategies`
    );

  checkStrategyArrays(
    `openapi-${n.dashed}-apidom`,
    p ? `'openapi-${p.dashed}-apidom'` : 'Swagger.resolveStrategies.generic'
  );
  const index = read('src/index.js');
  [
    `OpenApiJson${n.underscored}Parser`,
    `OpenApiYaml${n.underscored}Parser`,
    `OpenApi${n.underscored}SwaggerClientDereferenceStrategy`,
  ].forEach((name) =>
    check(
      new RegExp(`apidom = \\{[\\s\\S]*\\b${name},`).test(index),
      'wiring',
      `Swagger.apidom exports ${name}`,
      `Swagger.apidom doesn't export ${name}`
    )
  );
  check(
    read('src/subtree-resolver/index.js').includes(`isOpenAPI${n.compact}(`),
    'wiring',
    `src/subtree-resolver/index.js doesn't skip normalization for ${n.version}`,
    `src/subtree-resolver/index.js skips normalization for ${n.version} (its skipNormalization list lacks isOpenAPI${n.compact}; #3575 and #4295 fixed this for 3.1 and 3.2)`
  );
  checkEslint(`openapi-${n.dashed}`);

  checkDependency(`@swagger-api/apidom-ns-openapi-${n.dashed}`);
  ['json', 'yaml'].forEach((format) => {
    const adapter = `@swagger-api/apidom-parser-adapter-openapi-${format}-${n.dashed}`;
    check(
      Boolean(pkg.optionalDependencies?.[adapter]),
      'deps',
      `${adapter} is in optionalDependencies (mirrors apidom-reference)`,
      `${adapter} isn't in optionalDependencies (they mirror apidom-reference's)`
    );
  });
  checkApiDOMVersions();
};

const checkOpenAPIDocs = (n) => {
  check(
    new RegExp(`\\b${escape(n.version)}\\.\\d`).test(read('README.md')),
    'docs',
    `README.md's compatibility table lists ${n.version}.x`,
    `README.md's compatibility table doesn't list ${n.version}.x`
  );
  check(
    read('docs/usage/installation.md').includes(`apidom-parser-adapter-openapi-json-${n.dashed}`),
    'docs',
    `docs/usage/installation.md's optionalDependencies list has the ${n.version} adapters`,
    `docs/usage/installation.md's optionalDependencies list (--omit=optional) lacks the ${n.version} adapters`
  );
  check(
    read('CLAUDE.md').includes(`openapi-${n.dashed}-apidom`),
    'docs',
    `CLAUDE.md names the openapi-${n.dashed}-apidom strategy`,
    `CLAUDE.md doesn't name the openapi-${n.dashed}-apidom strategy`
  );
};

const checkOpenAPITests = (n, p) => {
  check(
    read('test/helpers/openapi-predicates.js').includes(`isOpenAPI${n.compact}`),
    'tests',
    `test/helpers/openapi-predicates.js tests isOpenAPI${n.compact}`,
    `test/helpers/openapi-predicates.js doesn't test isOpenAPI${n.compact}`
  );
  checkFiles('tests', [`test/execute/openapi-${n.dashed}.js`]);
  const dirs = (v) => [
    `test/resolver/strategies/openapi-${v.dashed}-apidom`,
    `test/resolver/apidom/reference/dereference/strategies/openapi-${v.dashed}-swagger-client`,
    `test/resolver/apidom/reference/parse/parsers/openapi-json-${v.dashed}`,
    `test/resolver/apidom/reference/parse/parsers/openapi-yaml-${v.dashed}`,
  ];
  checkFiles('tests', dirs(n));
  if (p) {
    const parentDirs = dirs(p);
    checkTestParity(dirs(n).map((dir, i) => [parentDirs[i], dir]));
  }
};

/**
 * Files outside the parent's own version folders that name the parent version but not the new
 * one. This is how the subtree resolver skipped normalization for 3.1 (#3575) and again for 3.2
 * (#4295): it keeps its own version list.
 */
const checkOpenAPIUnwired = (n, p) => {
  const parentFolder = new RegExp(`-${p.dashed}(?:[-/.]|$)`);
  const files = [
    ...walk(path('src'), (file) => /\.(js|mjs|cjs|ts)$/.test(file)),
    ...walk(path('test'), (file) => /\.(js|mjs|cjs|ts)$/.test(file)),
    ...walk(path('config'), (file) => /\.(js|mjs|cjs)$/.test(file)),
    path('.eslintrc.js'),
    path('package.json'),
  ].filter(
    (file) =>
      existsSync(file) && !parentFolder.test(rel(file)) && !/__(fixtures|snapshots)__/.test(file)
  );
  let hits = 0;
  files.forEach((file) => {
    const source = readFileSync(file, 'utf8');
    if (versionPattern(p).test(source) && !versionPattern(n).test(source)) {
      hits += 1;
      report('DECIDE', 'unwired', `${rel(file)} names OpenAPI ${p.version} but not ${n.version}`);
    }
  });
  if (hits === 0)
    report('OK', 'unwired', `every file naming OpenAPI ${p.version} also names ${n.version}`);
};

/* ------------------------------------------------------------------------------------------ */
/* JSON Schema                                                                                */
/* ------------------------------------------------------------------------------------------ */

const checkJSONSchema = (id, d) => {
  const label = `JSON Schema ${id}`;
  checkUpstream(`apidom-ns-json-schema-${d.pkg}`, `json-schema-${d.pkg}`, label);
  // The dereference strategy traverses with the namespace's keyMap and getNodeType; the 2020-12
  // namespace didn't export them on 2026-10-25 (ApiDOM phase 3 adds them).
  const namespaceDir = `node_modules/@swagger-api/apidom-ns-json-schema-${d.pkg}`;
  if (existsSync(path(namespaceDir))) {
    const namespaceIndex = read(namespaceDir, 'src/index.cjs') || read(namespaceDir, 'src/index.mjs');
    check(
      ['keyMap', 'getNodeType'].every((name) => namespaceIndex.includes(name)),
      'upstream',
      `@swagger-api/apidom-ns-json-schema-${d.pkg} exports keyMap and getNodeType`,
      `@swagger-api/apidom-ns-json-schema-${d.pkg} doesn't export keyMap and getNodeType: ApiDOM phase 3 for ${label}`,
      'UPSTREAM'
    );
  }

  const predicates = read('src/helpers/json-schema-predicates.js');
  check(
    predicates.includes(`export const isJSONSchema${d.compact} `) && predicates.includes(d.uri),
    'wiring',
    `src/helpers/json-schema-predicates.js exports isJSONSchema${d.compact} matching ${d.uri}`,
    `src/helpers/json-schema-predicates.js has no isJSONSchema${d.compact} matching ${d.uri}`
  );
  const strategyDir = `src/resolver/strategies/json-schema-${d.pkg}-apidom`;
  checkFiles('wiring', [
    `${strategyDir}/index.js`,
    `${strategyDir}/resolve.js`,
    `${strategyDir}/normalize.js`,
    `src/resolver/apidom/reference/parse/parsers/json-schema-json-${d.pkg}/index.js`,
    `src/resolver/apidom/reference/parse/parsers/json-schema-yaml-${d.pkg}/index.js`,
    `src/resolver/apidom/reference/dereference/strategies/json-schema-${d.pkg}-swagger-client/index.js`,
  ]);
  checkStrategyArrays(`json-schema-${d.pkg}-apidom`, 'Swagger.resolveStrategies.generic');
  const index = read('src/index.js');
  [
    `JsonSchemaJson${d.exports}Parser`,
    `JsonSchemaYaml${d.exports}Parser`,
    `JsonSchema${d.exports}SwaggerClientDereferenceStrategy`,
  ].forEach((name) =>
    check(
      new RegExp(`apidom = \\{[\\s\\S]*\\b${name},`).test(index),
      'wiring',
      `Swagger.apidom exports ${name}`,
      `Swagger.apidom doesn't export ${name}`
    )
  );
  checkEslint(`json-schema-${d.pkg}`);
  checkDependency(`@swagger-api/apidom-ns-json-schema-${d.pkg}`);
  ['json', 'yaml'].forEach((format) => {
    const adapter = `@swagger-api/apidom-parser-adapter-json-schema-${format}-${d.pkg}`;
    check(
      Boolean(pkg.optionalDependencies?.[adapter]),
      'deps',
      `${adapter} is in optionalDependencies (mirrors apidom-reference)`,
      `${adapter} isn't in optionalDependencies (they mirror apidom-reference's)`
    );
  });
  checkApiDOMVersions();

  check(
    new RegExp(`JSON Schema[^\\n]*${escape(id)}`).test(read('README.md')),
    'docs',
    `README.md lists ${label}`,
    `README.md doesn't list ${label}`
  );
  check(
    read('CLAUDE.md').includes(`json-schema-${d.pkg}-apidom`),
    'docs',
    `CLAUDE.md names the json-schema-${d.pkg}-apidom strategy`,
    `CLAUDE.md doesn't name the json-schema-${d.pkg}-apidom strategy`
  );

  check(
    read('test/helpers/json-schema-predicates.js').includes(`isJSONSchema${d.compact}`),
    'tests',
    `test/helpers/json-schema-predicates.js tests isJSONSchema${d.compact}`,
    `test/helpers/json-schema-predicates.js doesn't test isJSONSchema${d.compact}`
  );
  checkFiles('tests', [
    `test/resolver/strategies/json-schema-${d.pkg}-apidom`,
    `test/resolver/apidom/reference/dereference/strategies/json-schema-${d.pkg}-swagger-client`,
    `test/resolver/apidom/reference/parse/parsers/json-schema-json-${d.pkg}`,
    `test/resolver/apidom/reference/parse/parsers/json-schema-yaml-${d.pkg}`,
  ]);
  report(
    'NOTE',
    'consumer',
    `Swagger UI imports swagger-client/es/resolver/strategies/json-schema-${d.pkg}-apidom into both strategy lists of src/core/plugins/swagger-client/index.js (its /add-json-schema-support)`
  );
};

/* ------------------------------------------------------------------------------------------ */

if (values.oas) {
  const n = oasNames(values.oas);
  const [major, minor] = values.oas.split('.').map(Number);
  const parentVersion = values.parent ?? (minor > 0 ? `${major}.${minor - 1}` : null);
  const p = parentVersion ? oasNames(parentVersion) : null;
  checkOpenAPIUpstream(n);
  checkOpenAPIWiring(n, p);
  checkOpenAPIDocs(n);
  checkOpenAPITests(n, p);
  if (p) checkOpenAPIUnwired(n, p);
  else report('NOTE', 'unwired', 'no parent version: pass --parent for the unwired-file scan');
} else {
  const id = values['json-schema'];
  checkJSONSchema(id, DIALECTS[id]);
}

const order = ['UPSTREAM', 'MISSING', 'DECIDE', 'NOTE', 'OK'];
results
  .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))
  .forEach(({ status, area, message }) =>
    console.log(`${status.padEnd(8)} ${area.padEnd(9)} ${message}`)
  );
const count = (status) => results.filter((r) => r.status === status).length;
console.log(`\n${order.map((status) => `${count(status)} ${status}`).join(', ')}`);
if (count('UPSTREAM') > 0) process.exit(3);
if (count('MISSING') > 0) process.exit(1);
