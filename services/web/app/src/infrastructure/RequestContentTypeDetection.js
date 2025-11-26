module.exports = {
  acceptsJson(req) {
    return req.accepts(['html', 'json']) === 'json'
  },
}
