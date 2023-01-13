/**
 * Turn an async function into an Express middleware
 */
function expressify(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}

module.exports = expressify
