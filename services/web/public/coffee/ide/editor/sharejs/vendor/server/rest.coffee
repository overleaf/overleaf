# A REST-ful frontend to the OT server.
#
# See the docs for details and examples about how the protocol works.

http = require 'http'
url = require 'url'

connect = require 'connect'

send403 = (res, message = 'Forbidden\n') ->
  res.writeHead 403, {'Content-Type': 'text/plain'}
  res.end message

send404 = (res, message = '404: Your document could not be found.\n') ->
  res.writeHead 404, {'Content-Type': 'text/plain'}
  res.end message

sendError = (res, message, head = false) ->
  if message == 'forbidden'
    if head
      send403 res, ""
    else
      send403 res
  else if message == 'Document does not exist'
    if head
      send404 res, ""
    else
      send404 res
  else
    console.warn "REST server does not know how to send error: '#{message}'"
    if head
      res.writeHead 500, {'Content-Type': 'text/plain'}
      res.end "Error: #{message}\n"
    else
      res.writeHead 500, {}
      res.end ""

send400 = (res, message) ->
  res.writeHead 400, {'Content-Type': 'text/plain'}
  res.end message

send200 = (res, message = "OK\n") ->
  res.writeHead 200, {'Content-Type': 'text/plain'}
  res.end message

sendJSON = (res, obj) ->
  res.writeHead 200, {'Content-Type': 'application/json'}
  res.end JSON.stringify(obj) + '\n'

# Callback is only called if the object was indeed JSON
expectJSONObject = (req, res, callback) ->
  pump req, (data) ->
    try
      obj = JSON.parse data
    catch error
      send400 res, 'Supplied JSON invalid'
      return

    callback(obj)

pump = (req, callback) ->
  data = ''
  req.on 'data', (chunk) -> data += chunk
  req.on 'end', () -> callback(data)

# connect.router will be removed in connect 2.0 - this code will have to be rewritten or
# more libraries pulled in.
# https://github.com/senchalabs/connect/issues/262
router = (app, createClient, options) ->
  auth = (req, res, next) ->
    data =
      headers: req.headers
      remoteAddress: req.connection.remoteAddress

    createClient data, (error, client) ->
      if client
        req._client = client
        next()
      else
        sendError res, error

  # GET returns the document snapshot. The version and type are sent as headers.
  # I'm not sure what to do with document metadata - it is inaccessable for now.
  app.get '/doc/:name', auth, (req, res) ->
    req._client.getSnapshot req.params.name, (error, doc) ->
      if doc  
        res.setHeader 'X-OT-Type', doc.type.name
        res.setHeader 'X-OT-Version', doc.v
        if req.method == "HEAD"
          send200 res, ""
        else
          if typeof doc.snapshot == 'string'
            send200 res, doc.snapshot
          else
            sendJSON res, doc.snapshot
      else
        if req.method == "HEAD"
          sendError res, error, true
        else
          sendError res, error
          
  # Put is used to create a document. The contents are a JSON object with {type:TYPENAME, meta:{...}}
  app.put '/doc/:name', auth, (req, res) ->
    expectJSONObject req, res, (obj) ->
      type = obj?.type
      meta = obj?.meta

      unless typeof type == 'string' and (meta == undefined or typeof meta == 'object')
        send400 res, 'Type invalid'
      else
        req._client.create req.params.name, type, meta, (error) ->
          if error
            sendError res, error
          else
            send200 res

  # POST submits an op to the document.
  app.post '/doc/:name', auth, (req, res) ->
    query = url.parse(req.url, true).query

    version = if query?.v?
      parseInt query?.v
    else
      parseInt req.headers['x-ot-version']
    
    unless version? and version >= 0
      send400 res, 'Version required - attach query parameter ?v=X on your URL or set the X-OT-Version header'
    else
      expectJSONObject req, res, (obj) ->
        opData = {v:version, op:obj, meta:{source:req.socket.remoteAddress}}
        req._client.submitOp req.params.name, opData, (error, newVersion) ->
          if error?
            sendError res, error
          else
            sendJSON res, {v:newVersion}

  app.delete '/doc/:name', auth, (req, res) ->
    req._client.delete req.params.name, (error) ->
      if error
        sendError res, error
      else
        send200 res

# Attach the frontend to the supplied http.Server.
# 
# As of sharejs 0.4.0, options is ignored. To control the deleting of documents, specify an auth() function.
module.exports = (createClient, options) ->
  connect.router (app) -> router(app, createClient, options)
