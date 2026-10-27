import getRootCause from '../../../../../../../../src/resolver/apidom/reference/dereference/strategies/json-schema-2020-12-swagger-client/utils/get-root-cause.js';

describe('getRootCause', () => {
  describe('given an error with no cause', () => {
    test('should return the error itself', () => {
      const error = new Error('original');

      expect(getRootCause(error)).toBe(error);
    });
  });

  describe('given an error with cause explicitly set to null', () => {
    test('should return the error itself', () => {
      const error = new Error('original');
      error.cause = null;

      expect(getRootCause(error)).toBe(error);
    });
  });

  describe('given an error with cause set to undefined', () => {
    test('should return the error itself', () => {
      const error = new Error('original');
      error.cause = undefined;

      expect(getRootCause(error)).toBe(error);
    });
  });

  describe('given an error with a single cause', () => {
    test('should return the direct cause', () => {
      const root = new Error('root cause');
      const error = new Error('outer', { cause: root });

      expect(getRootCause(error)).toBe(root);
    });
  });

  describe('given an error with a deeply nested cause chain', () => {
    test('should return the deepest root cause', () => {
      const root = new Error('root cause');
      const middle = new Error('middle', { cause: root });
      const outer = new Error('outer', { cause: middle });

      expect(getRootCause(outer)).toBe(root);
    });

    test('should traverse a chain of arbitrary depth', () => {
      const root = new Error('root');
      let current = root;
      for (let i = 0; i < 10; i += 1) {
        const next = new Error(`level ${i}`);
        next.cause = current;
        current = next;
      }

      expect(getRootCause(current)).toBe(root);
    });
  });

  describe('given an error where an intermediate cause has null cause', () => {
    test('should stop traversal at the null cause boundary', () => {
      const root = new Error('root');
      root.cause = null;
      const outer = new Error('outer', { cause: root });

      expect(getRootCause(outer)).toBe(root);
    });
  });
});
