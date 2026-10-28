/**
 * Standalone JSON Schema documents have no operations, parameters or security requirements,
 * so the OpenAPI normalization plugins have nothing to act on: normalization is the identity.
 *
 * The subtree resolver skips normalization for every strategy but the OpenAPI 3.1+ ones;
 * add this strategy to its list if normalization here ever does something.
 */
const normalize = (spec) => spec;

export default normalize;
