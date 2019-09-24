module.exports = function expressify(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
