
register = (file) ->
  type = require file
  exports[type.name] = type
  try require "#{file}-api"

# Import all the built-in types.
register './simple'
register './count'

register './text'
register './text-composable'
register './text-tp2'

register './json'
