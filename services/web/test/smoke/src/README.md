# SmokeTests

For the SmokeTests we implemented a Mini-Framework that is tailored for our
 tooling, specifically OError, and does not need a large runner, such as mocha.

The SmokeTests are separated into individual `steps`.
Each `step` can have a `run` function and a `cleanup` function.
The former will run in sequence with the other steps, the later in reverse
 order from the finish, or the last failure.

```js
async function run(ctx) {
  // do something
}
async function cleanup(ctx) {
  // cleanup something
}
module.exports = { cleanup, run }
```

Steps will get called with a context object with common helpers and details:
- `request` a promisified `request` module with defaults for `baseUrl`,
   `timeout` and internals for cookie handling.
- `assertHasStatusCode` a helper for asserting response status codes, pass
   a response and desired status code. It will throw with OError context set.
- `getCsrfTokenFor` a helper for retrieving CSRF tokens, pass an endpoint.
- `processWithTimeout` a helper for awaiting Promises with a timeout, pass
   `{ work: Promise.resolve(), timeout: 42, message: 'foo timedout' }`
- `stats` an object for performance tracking.
- `timeout` the step timeout

Steps should handle timeouts locally to ensure appropriate cleanup of timed out
 actions.

Steps may pass values along to the next steps in returning an object with the
 desired fields from the `run` or `cleanup` function.
The returned values will overwrite existing details in the `ctx`.

Alpha-numeric sorting of step filenames determines the processing sequence.
