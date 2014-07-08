# OT storage for CouchDB
# Author: Max Ogden (@maxogden)
#
# The couchdb database contains two kinds of documents:
#
# - Document snapshots have a key which is doc:the document name
# - Document ops have a random key, but docName: defined.

request = require('request').defaults json: true

# Helper method to parse errors out of couchdb. There's way more ways
# things can go wrong, but I think this catches all the ones I care about.
#
# callback(error) or callback()
parseError = (err, resp, body, callback) ->
  body = body[0] if Array.isArray body and body.length >= 1

  if err
    # This indicates an HTTP error
    callback err
  else if resp.statusCode is 404
    callback 'Document does not exist'
  else if resp.statusCode is 403
    callback 'forbidden'
  else if typeof body is 'object'
    if body.error is 'conflict'
      callback 'Document already exists'
    else if body.error
      callback "#{body.error} reason: #{body.reason}"
    else
      callback()
  else
    callback()

module.exports = (options) ->
  options ?= {}
  db = options.uri or "http://localhost:5984/sharejs"

  uriForDoc = (docName) -> "#{db}/doc:#{encodeURIComponent docName}"
  uriForOps = (docName, start, end, include_docs) ->
    startkey = encodeURIComponent(JSON.stringify [docName, start])
    # {} is sorted after all numbers - so this will get all ops in the case that end is null.
    endkey = encodeURIComponent(JSON.stringify [docName, end ? {}])

    # Another way to write this method would be to use node's builtin uri-encoder.
    extra = if include_docs then '&include_docs=true' else ''
    "#{db}/_design/sharejs/_view/operations?startkey=#{startkey}&endkey=#{endkey}&inclusive_end=false#{extra}"

  # Helper method to get the revision of a document snapshot.
  getRev = (docName, dbMeta, callback) ->
    if dbMeta?.rev
      callback null, dbMeta.rev
    else
      # JSON defaults to true, and that makes request think I'm trying to sneak a request
      # body in. Ugh.
      request.head {uri:uriForDoc(docName), json:false}, (err, resp, body) ->
        parseError err, resp, body, (error) ->
          if error
            callback error
          else
            # The etag is the rev in quotes.
            callback null, JSON.parse(resp.headers.etag)
  
  writeSnapshotInternal = (docName, data, rev, callback) ->
    body = data
    body.fieldType = 'Document'
    body._rev = rev if rev?

    request.put uri:(uriForDoc docName), body:body, (err, resp, body) ->
      parseError err, resp, body, (error) ->
        if error
          #console.log 'create error'
          # This will send write conflicts as 'document already exists'. Thats kinda wierd, but
          # it shouldn't happen anyway
          callback? error
        else
          # We pass the document revision back to the db cache so it can give it back to couchdb on subsequent requests.
          callback? null, {rev: body.rev}

  # getOps returns all ops between start and end. end can be null.
  getOps: (docName, start, end, callback) ->
    return callback null, [] if start == end
    
    # Its a bit gross having this end parameter here....
    endkey = if end? then [docName, end - 1]
    
    request uriForOps(docName, start, end), (err, resp, body) ->
      # Rows look like this:
      # {"id":"<uuid>","key":["doc name",0],"value":{"op":[{"p":0,"i":"hi"}],"meta":{}}}
      data = ({op: row.value.op, meta: row.value.meta} for row in body.rows)
      callback null, data
  
  # callback(error, db metadata)
  create: (docName, data, callback) ->
    writeSnapshotInternal docName, data, null, callback
 
  delete: del = (docName, dbMeta, callback) ->
    getRev docName, dbMeta, (error, rev) ->
      return callback? error if error

      docs = [{_id:"doc:#{docName}", _rev:rev, _deleted:true}]
      # Its annoying, but we need to get the revision from the document. I don't think there's a simple way to do this.
      # This request will get all the ops twice.
      request uriForOps(docName, 0, null, true), (err, resp, body) ->
        # Rows look like this:
        # {"id":"<uuid>","key":["doc name",0],"value":{"op":[{"p":0,"i":"hi"}],"meta":{}},
        #  "doc":{"_id":"<uuid>","_rev":"1-21a40c56ebd5d424ffe56950e77bc847","op":[{"p":0,"i":"hi"}],"v":0,"meta":{},"docName":"doc6"}}
        for row in body.rows
          row.doc._deleted = true
          docs.push row.doc

        request.post url: "#{db}/_bulk_docs", body: {docs}, (err, resp, body) ->
          if body[0].error is 'conflict'
            # Somebody has edited the document since we did a GET on the revision information. Recurse.
            # By passing null to dbMeta I'm forcing the revision information to be reacquired.
            del docName, null, callback
          else
            parseError err, resp, body, (error) -> callback? error
 
  writeOp: (docName, opData, callback) ->
    body =
      docName: docName
      op: opData.op
      v: opData.v
      meta: opData.meta

    request.post url:db, body:body, (err, resp, body) ->
      parseError err, resp, body, callback

  writeSnapshot: (docName, docData, dbMeta, callback) ->
    getRev docName, dbMeta, (error, rev) ->
      return callback? error if error

      writeSnapshotInternal docName, docData, rev, callback

  getSnapshot: (docName, callback) ->
    request uriForDoc(docName), (err, resp, body) ->
      parseError err, resp, body, (error) ->
        if error
          callback error
        else
          callback null,
              snapshot: body.snapshot
              type: body.type
              meta: body.meta
              v: body.v
            , {rev: body._rev} # dbMeta

  close: ->
