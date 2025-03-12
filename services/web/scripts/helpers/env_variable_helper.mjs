/**
 * Ensures that the specific MongoDB connection timeout is set.
 *
 * @param {number} timeoutInMS
 * @returns {void}
 */
export function ensureMongoTimeout(timeoutInMS) {
  if (process.env.MONGO_SOCKET_TIMEOUT !== timeoutInMS.toString()) {
    throw new Error(
      `must run with higher mongo timeout: MONGO_SOCKET_TIMEOUT=${timeoutInMS} node ${process.argv[1]}`
    )
  }
}

/**
 * Ensures MongoDB queries are running on secondary and the specific connection timeout is set.
 *
 * @param {number} timeoutInMS
 * @returns {void}
 */
export function ensureRunningOnMongoSecondaryWithTimeout(timeoutInMS) {
  const timeout = parseInt(process.env.MONGO_SOCKET_TIMEOUT, 10) || 0
  if (
    timeout < timeoutInMS ||
    process.env.MONGO_CONNECTION_STRING !==
      process.env.READ_ONLY_MONGO_CONNECTION_STRING
  ) {
    throw new Error(
      `must run on secondary with higher mongo timeout: MONGO_SOCKET_TIMEOUT=${timeoutInMS} MONGO_CONNECTION_STRING="$READ_ONLY_MONGO_CONNECTION_STRING" node ${process.argv[1]}`
    )
  }
}
