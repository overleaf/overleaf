---
mode: 'agent'
description: 'Generate a clear code explanation with examples'
---

# Improved Async/Await Migration Instructions

Based on lessons learned from PR #28840 and reviewer feedback, these comprehensive instructions address the original migration requirements while preventing common issues.

## Core Migration Principles

### 1. Function Signature Transformation

- Convert callback-style functions to async/await
- Remove callback parameters from function signatures
- Add `async` keyword to function declarations
- Replace `return callback(err, result)` with `throw err` or `return result`
- Replace `return callback()` with `return` (or `return undefined`)

### 2. Error Handling Patterns

#### OError.tag Usage - CRITICAL UPDATE

**DO NOT** wrap simple operations in try/catch just to tag errors with OError. With async/await, the stack trace is preserved automatically, making OError.tag less necessary for basic error propagation.

```javascript
// OLD (callback style) - OError.tag was needed
callback(err) => {
  OError.tag(err, 'description', { context })
  return callback(err)
}

// BAD (unnecessary with async/await)
try {
  await operation()
} catch (err) {
  throw OError.tag(err, 'description', { context })
}

// GOOD (let errors propagate naturally)
await operation()

// ONLY use OError.tag when adding meaningful context or transforming errors
try {
  await complexOperation()
} catch (err) {
  if (err.code === 'SPECIFIC_ERROR') {
    throw OError.tag(err, 'meaningful context about why this failed', {
      important_context: value
    })
  }
  throw err // let other errors propagate unchanged
}
```

### 3. Concurrency Considerations - CRITICAL

#### Sequential vs Parallel Operations

**Be extremely cautious when converting from serial to parallel operations.** The original code's choice of sequential processing is often intentional.

```javascript
// OLD - Sequential processing (often intentional)
Async.mapSeries(items, processItem, callback)

// BAD - Unbounded parallel processing
await Promise.all(items.map(processItem))

// BETTER - Keep sequential if unsure about resource limits
for (const item of items) {
  await processItem(item)
}

// GOOD - Controlled batch processing for performance
const BATCH_SIZE = 10
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE)
  await Promise.all(batch.map(processItem))
}

// IDEAL - Use Redis MGET for multiple key retrieval
// Instead of: Promise.all(keys.map(k => redis.get(k)))
const values = await redis.mget(keys)
```

#### Database/Redis Operation Guidelines

- **Never** send unbounded parallel requests to databases
- **Prefer** sequential processing for database operations unless there's a specific performance need
- **Consider** batch operations (like Redis MGET/MSET) for multiple operations
- **Implement** maximum concurrency limits when parallel processing is necessary

### 4. Background Operations

#### Fire-and-Forget Pattern

When operations were called in the background (with empty callbacks), preserve this behavior:

```javascript
// OLD - Background operation with ignored callback
someOperation(user, function () {}) // errors swallowed

// GOOD - Preserve background behavior
someOperation(user).catch(err => {
  logger.error({ err }, 'Failed to run background operation')
})

// Or if truly fire-and-forget:
someOperation(user).catch(() => {}) // explicitly ignore errors
```

### 5. Module Export Patterns

#### Using callbackifyAll for Dual API

```javascript
const { callbackifyAll } = require('@overleaf/promise-utils')

const MyModule = {
  async myMethod(param) {
    // async implementation
  },
}

const moduleExports = {
  ...callbackifyAll(MyModule), // callback API
  promises: MyModule, // promise API
}

module.exports = moduleExports
```

#### Internal Method Stubbing (for testing)

**Only** add method binding patterns when tests need to stub internal method calls:

```javascript
// ONLY if tests need to stub internal calls to _internalMethod
MyModule._internalMethod = (...args) => moduleExports._internalMethod(...args)
```

**Do NOT** expose internal methods at the top level - they should be accessible via `moduleExports.promises._internalMethod`.

### 6. Test Migration Patterns

#### Async Test Conversion

```javascript
// OLD
it('should do something', function (done) {
  MyModule.method(param, function (err, result) {
    expect(err).to.not.exist
    expect(result).to.equal(expected)
    done()
  })
})

// NEW
it('should do something', async function () {
  const result = await MyModule.promises.method(param)
  expect(result).to.equal(expected)
})
```

#### Mock/Stub Patterns

```javascript
// For Redis or database mocks, ensure method chaining works
beforeEach(function () {
  redis.multi = sinon.stub().returns({
    sadd: sinon.stub().returnsThis(),
    pexpire: sinon.stub().returnsThis(),
    exec: sinon.stub().resolves(),
  })
})
```

### 7. Specific Redis Patterns

#### Multi-Transaction Operations

```javascript
// Correct pattern for Redis multi operations
const multi = redis.multi()
multi.sadd(key, value)
multi.pexpire(key, ttl)
await multi.exec()
```

#### Single vs Multiple Key Operations

```javascript
// BAD - Multiple individual operations
const values = await Promise.all(keys.map(k => redis.get(k)))

// GOOD - Use batch operations when available
const values = await redis.mget(keys)
```

## Migration Checklist

### Before Starting

- [ ] Understand the original code's concurrency patterns
- [ ] Identify any background operations that should remain non-blocking
- [ ] Check if Redis batch operations can replace individual operations
- [ ] Look for internal method calls that might need test stubbing

### During Migration

- [ ] Convert function signatures (remove callbacks, add async)
- [ ] Replace callback patterns with await
- [ ] Handle early returns properly
- [ ] Preserve sequential processing unless there's a clear performance benefit
- [ ] Keep background operations non-blocking
- [ ] Avoid unnecessary OError.tag wrapping
- [ ] Update JSDoc comments to remove callback parameters

### After Migration

- [ ] Run comprehensive tests (fix Docker/environment issues if needed)
- [ ] Verify all background operations still work correctly
- [ ] Check that internal method calls can be stubbed if needed
- [ ] Ensure database operations don't overwhelm resources
- [ ] Validate error handling preserves meaningful context
- [ ] **Remove all decaffeinate artifacts from both implementation AND test files**
- [ ] Add explanatory comments for any non-obvious technical patterns
- [ ] Avoid selfRef patterns - use module exports routing instead

### Test Migration

- [ ] **Run tests EARLY and OFTEN during migration process**
- [ ] Convert test functions to async
- [ ] Update assertion patterns
- [ ] Fix mock/stub configurations for chained operations (Redis multi, etc.)
- [ ] Verify all test scenarios still pass
- [ ] Remove duplicate or unnecessary mock setups
- [ ] Clean up decaffeinate comments from test files
- [ ] Ensure internal method stubs work through promises interface

## Critical Lessons from Real Migration Experience

### 1. Testing Environment Issues

**ALWAYS run tests early and often during migration.** Don't wait until the end.

Common test running problems:

- Docker containers may need cleanup: `docker system prune -f`
- Use specific test grep patterns: `MOCHA_GREP="ModuleName" make test_unit_app`
- Mock objects must return proper objects for chaining (e.g., `multi()` must return `{method: stub().returnsThis(), ...}`)

### 2. Method Stubbing for Internal Calls

When methods call other methods internally, tests may need to stub those calls:

```javascript
// If methodA() calls methodB() internally and tests need to verify this:
// DON'T do this - creates unnecessary complexity:
const selfRef = { ... }; // BAD pattern

// DO this - route through the module exports interface:
moduleExports.promises.methodB(params).catch(err => {
  logger.error({ err }, 'Failed to run background operation')
})

// Add a brief comment explaining the routing pattern:
// Route through moduleExports so tests can stub this call
```

### 3. Avoid the selfRef Pattern

The `selfRef` pattern should be avoided - it's a code smell that indicates better module structure is needed:

```javascript
// BAD - selfRef pattern
const selfRef = {}
selfRef.methodA = async function() {
  await selfRef.methodB() // circular reference
}

// GOOD - route through module exports when stubbing is needed
async methodA() {
  await moduleExports.promises.methodB() // testable
}
```

### 4. Complete Decaffeinate Cleanup

**Remove ALL legacy CoffeeScript artifacts** - this is a required part of the migration.

Look for and remove patterns like these (exact format may vary):

```javascript
/* eslint-disable */
// TODO: This file was created by bulk-decaffeinate.

/* eslint-disable
    camelcase,
    n/handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/

// Fix any style issues and re-enable lint.

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
```

**Search patterns to look for:**

- Comments containing "bulk-decaffeinate" or "decaffeinate"
- Large `/* eslint-disable */` blocks at the top of files
- Comments about "Fix any style issues and re-enable lint"
- "decaffeinate suggestions" comment blocks

Check **both implementation AND test files** for these artifacts.

### 5. Add Explanatory Comments for Non-Obvious Code

When you need to write "ugly" code for unavoidable technical reasons, add a brief comment explaining why:

```javascript
// Background operation - preserve fire-and-forget behavior
// Route through moduleExports so tests can stub this call
moduleExports.promises._checkSessions(user).catch(err => {
  logger.error({ err }, 'Failed to check sessions in background')
})
```

This prevents future developers from "refactoring" the code and breaking functionality.

### 6. Simplify OError.tag() Usage

**With async/await, many OError.tag() wrappers can be removed.** OError.tag() was primarily used to preserve stack traces across callback boundaries, but async/await handles this automatically.

```javascript
// BEFORE - callback era (needed OError.tag for stack traces)
try {
  await redis.multi().sadd(key, value).exec()
} catch (err) {
  throw OError.tag(err, 'error adding to redis set', { key })
}

// AFTER - async/await preserves stack traces naturally
await redis.multi().sadd(key, value).exec()
```

**Keep OError.tag() only when:**

- Adding meaningful context that aids debugging
- Transforming low-level errors into domain-specific errors
- The wrapper adds significant value beyond just a descriptive message

**Remove OError.tag() when:**

- The error message doesn't add meaningful context
- The tag message just restates what the code obviously does
- Stack trace preservation was the only benefit

## Common Pitfalls to Avoid

1. **Over-parallelization**: Don't convert all sequential operations to parallel
2. **Unnecessary error wrapping**: Don't wrap every operation in try/catch just for OError.tag
3. **Breaking background operations**: Maintain fire-and-forget behavior where intended
4. **Exposing internal methods incorrectly**: Use the promises interface, not top-level exports
5. **Resource exhaustion**: Be mindful of database connection limits and Redis performance
6. **Test mock complexity**: Keep mocks simple and targeted to what's actually needed
7. **Using selfRef patterns**: Always route through module exports instead
8. **Forgetting decaffeinate cleanup**: Remove all legacy comments and eslint disables
9. **Not running tests early**: Run tests frequently during migration, not just at the end
10. **Missing explanatory comments**: Add brief comments for non-obvious technical patterns

## Success Metrics

- All existing tests pass without modification (except for async conversion)
- No new resource exhaustion issues under load
- Background operations continue to work as intended
- Error messages and logging remain informative
- Internal method stubbing works correctly for testing
- Code is cleaner and more maintainable than before

These instructions should be applied systematically, with careful consideration of the specific context and requirements of each module being migrated.
