function setSource(source) {
  return function (req, res, next) {
    if (req.session) {
      req.session.required_login_for = source
    }
    next()
  }
}

function clearSource() {
  return function (req, res, next) {
    doClearSource(req.session)
    next()
  }
}

function doClearSource(session) {
  if (session) {
    delete session.required_login_for
  }
}

module.exports = {
  setSource,
  clearSource,
  doClearSource,
}
