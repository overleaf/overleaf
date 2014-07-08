# This is an implementation of the OT data backend for redis.
#   http://redis.io/
#
# This implementation isn't written to support multiple frontends
# talking to a single redis backend using redis's transactions.

redis = require 'redis'

defaultOptions = {
  # Prefix for all database keys.
  prefix: 'ShareJS:'

  # Inherit the default options from redis. (Hostname: 127.0.0.1, port: 6379)
  hostname: null
  port: null
  redisOptions: null
  auth: null

  # If this is set to true, the client will select db 15 and wipe all data in
  # this database.
  testing: false
}

# Valid options as above.
module.exports = RedisDb = (options) ->
  return new Db if !(this instanceof RedisDb)

  options ?= {}
  options[k] ?= v for k, v of defaultOptions

  keyForOps = (docName) -> "#{options.prefix}ops:#{docName}"
  keyForDoc = (docName) -> "#{options.prefix}doc:#{docName}"

  client = redis.createClient options.port, options.hostname, options.redisOptions

  if options.auth and typeof options.auth == "string"
    client.auth(if ":" in options.auth then options.auth.split(":").pop() else options.auth)

  client.select 15 if options.testing

  # Creates a new document.
  # data = {snapshot, type:typename, [meta]}
  # calls callback(true) if the document was created or callback(false) if a document with that name
  # already exists.
  @create = (docName, data, callback) ->
    value = JSON.stringify(data)
    client.setnx keyForDoc(docName), value, (err, result) ->
      return callback? err if err

      if result
        callback?()
      else
        callback? 'Document already exists'

  # Get all ops with version = start to version = end. Noninclusive.
  # end is trimmed to the size of the document.
  # If any documents are passed to the callback, the first one has v = start
  # end can be null. If so, returns all documents from start onwards.
  # Each document returned is in the form {op:o, meta:m, v:version}.
  @getOps = (docName, start, end, callback) ->
    if start == end
      callback null, []
      return

    # In redis, lrange values are inclusive.
    if end?
      end--
    else
      end = -1

    client.lrange keyForOps(docName), start, end, (err, values) ->
      throw err if err?
      ops = (JSON.parse value for value in values)
      callback null, ops

  # Write an op to a document.
  #
  # opData = {op:the op to append, v:version, meta:optional metadata object containing author, etc.}
  # callback = callback when op committed
  # 
  # opData.v MUST be the subsequent version for the document.
  #
  # This function has UNDEFINED BEHAVIOUR if you call append before calling create().
  # (its either that, or I have _another_ check when you append an op that the document already exists
  # ... and that would slow it down a bit.)
  @writeOp = (docName, opData, callback) ->
    # ****** NOT SAFE FOR MULTIPLE PROCESSES. Rewrite me using transactions or something.

    # The version isn't stored.
    json = JSON.stringify {op:opData.op, meta:opData.meta}
    client.rpush keyForOps(docName), json, (err, response) ->
      return callback err if err

      if response == opData.v + 1
        callback()
      else
        # The document has been corrupted by the change. For now, throw an exception.
        # Later, rebuild the snapshot.
        callback "Version mismatch in db.append. '#{docName}' is corrupted."
    
  # Write new snapshot data to the database.
  #
  # docData = resultant document snapshot data. {snapshot:s, type:t, meta}
  #
  # The callback just takes an optional error.
  #
  # This function has UNDEFINED BEHAVIOUR if you call append before calling create().
  @writeSnapshot = (docName, docData, dbMeta, callback) ->
    client.set keyForDoc(docName), JSON.stringify(docData), (err, response) ->
      callback? err

  # Data = {v, snapshot, type}. Snapshot == null and v = 0 if the document doesn't exist.
  @getSnapshot = (docName, callback) ->
    client.get keyForDoc(docName), (err, response) ->
      throw err if err?

      if response != null
        docData = JSON.parse(response)
        callback null, docData
      else
        callback 'Document does not exist'

  # Perminantly deletes a document. There is no undo.
  # Callback takes a single argument which is true iff something was deleted.
  @delete = (docName, dbMeta, callback) ->
    client.del keyForOps(docName)
    client.del keyForDoc(docName), (err, response) ->
      throw err if err?
      if callback
        if response == 1
          # Something was deleted.
          callback null
        else
          callback 'Document does not exist'
  
  # Close the connection to the database
  @close = ->
    client.quit()

  this
