export function acceptsJson(req) {
  return req.accepts(['html', 'json']) === 'json'
}
