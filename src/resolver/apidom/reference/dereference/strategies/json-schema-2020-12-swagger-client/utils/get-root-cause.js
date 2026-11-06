/**
 * Retrieves the root cause of ApiDOM error hierarchy.
 * ApiDOM error hierarchies are modeled similar to Java.
 * Every error can have cause attribute which references
 * cause of this error.
 */
const getRootCause = (error) => {
  if (error.cause == null) return error;

  let { cause } = error;
  while (cause.cause != null) {
    cause = cause.cause;
  }
  return cause;
};

export default getRootCause;
