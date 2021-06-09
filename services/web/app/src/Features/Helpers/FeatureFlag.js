function shouldDisplayFeature(req, name, variantFlag) {
  if (req.query && req.query[name]) {
    return req.query[name] === 'true'
  } else {
    return variantFlag === true
  }
}

module.exports = { shouldDisplayFeature }
