/**
 * Transform an async function into an Express middleware
 *
 * Any error will be passed to the error middlewares via `next()`
 */
export function expressify(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
