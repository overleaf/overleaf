# This is a simple switch for the different database implementations.
#
# The interface is the same as the regular database implementations, except
# the options object can have another type:<TYPE> parameter which specifies
# which type of database to use.
#
# Example usage:
#  require('server/db').create {type:'redis'}

defaultType = 'redis'

module.exports = (options) ->
  options ?= {}
  type = options.type ? defaultType

  console.warn "Database type: 'memory' detected. This has been deprecated and will
 be removed in a future version. Use 'none' instead, or just remove the db:{} block
 from your options." if type is 'memory'

  if type in ['none', 'memory']
    null
  else
    Db = switch type
      when 'redis' then require './redis'
      when 'couchdb' then require './couchdb'
      when 'pg' then require './pg'
      else throw new Error "Invalid or unsupported database type: '#{type}'"
    new Db options
