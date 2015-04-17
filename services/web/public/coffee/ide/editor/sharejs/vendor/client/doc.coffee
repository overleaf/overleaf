unless WEB?
  types = require '../types'

if WEB?
  exports.extendDoc = (name, fn) ->
    Doc::[name] = fn

# A Doc is a client's view on a sharejs document.
#
# Documents are created by calling Connection.open().
#
# Documents are event emitters - use doc.on(eventname, fn) to subscribe.
#
# Documents get mixed in with their type's API methods. So, you can .insert('foo', 0) into
# a text document and stuff like that.
#
# Events:
#  - remoteop (op)
#  - changed (op)
#  - acknowledge (op)
#  - error
#  - open, closing, closed. 'closing' is not guaranteed to fire before closed.
class Doc
  # connection is a Connection object.
  # name is the documents' docName.
  # data can optionally contain known document data, and initial open() call arguments:
  # {v[erson], snapshot={...}, type, create=true/false/undefined}
  # callback will be called once the document is first opened.
  constructor: (@connection, @name, openData) ->
    # Any of these can be null / undefined at this stage.
    openData ||= {}
    @version = openData.v
    @snapshot = openData.snaphot
    @_setType openData.type if openData.type

    @state = 'closed'
    @autoOpen = false

    # Has the document already been created?
    @_create = openData.create

    # The op that is currently roundtripping to the server, or null.
    #
    # When the connection reconnects, the inflight op is resubmitted.
    @inflightOp = null
    @inflightCallbacks = []
    # The auth ids which the client has previously used to attempt to send inflightOp. This is
    # usually empty.
    @inflightSubmittedIds = []

    # All ops that are waiting for the server to acknowledge @inflightOp
    @pendingOp = null
    @pendingCallbacks = []

    # Some recent ops, incase submitOp is called with an old op version number.
    @serverOps = {}

  # Transform a server op by a client op, and vice versa.
  _xf: (client, server) ->
    if @type.transformX
      @type.transformX(client, server)
    else
      client_ = @type.transform client, server, 'left'
      server_ = @type.transform server, client, 'right'
      return [client_, server_]
  
  _otApply: (docOp, isRemote) ->
    oldSnapshot = @snapshot
    @snapshot = @type.apply(@snapshot, docOp)

    # Its important that these event handlers are called with oldSnapshot.
    # The reason is that the OT type APIs might need to access the snapshots to
    # determine information about the received op.
    @emit 'change', docOp, oldSnapshot
    @emit 'remoteop', docOp, oldSnapshot if isRemote
  
  _connectionStateChanged: (state, data) ->
    switch state
      when 'disconnected'
        @state = 'closed'
        # This is used by the server to make sure that when an op is resubmitted it
        # doesn't end up getting applied twice.
        @inflightSubmittedIds.push @connection.id if @inflightOp

        @emit 'closed'

      when 'ok' # Might be able to do this when we're connecting... that would save a roundtrip.
        @open() if @autoOpen

      when 'stopped'
        @_openCallback? data

    @emit state, data

  _setType: (type) ->
    if typeof type is 'string'
      type = types[type]

    throw new Error 'Support for types without compose() is not implemented' unless type and type.compose

    @type = type
    if type.api
      this[k] = v for k, v of type.api
      @_register?()
    else
      @provides = {}

  _onMessage: (msg) ->
    #console.warn 's->c', msg
    if msg.open == true
      # The document has been successfully opened.
      @state = 'open'
      @_create = false # Don't try and create the document again next time open() is called.
      unless @created?
        @created = !!msg.create

      @_setType msg.type if msg.type
      if msg.create
        @created = true
        @snapshot = @type.create()
      else
        @created = false unless @created is true
        @snapshot = msg.snapshot if msg.snapshot isnt undefined

      @version = msg.v if msg.v?

      # Resend any previously queued operation.
      if @inflightOp
        response =
          doc: @name
          op: @inflightOp
          v: @version
        response.dupIfSource = @inflightSubmittedIds if @inflightSubmittedIds.length
        @connection.send response
      else
        @flush()

      @emit 'open'
      
      @_openCallback? null
 
    else if msg.open == false
      # The document has either been closed, or an open request has failed.
      if msg.error
        # An error occurred opening the document.
        console?.error "Could not open document: #{msg.error}"
        @emit 'error', msg.error
        @_openCallback? msg.error

      @state = 'closed'
      @emit 'closed'

      @_closeCallback?()
      @_closeCallback = null

    else if msg.op is null and error is 'Op already submitted'
      # We've tried to resend an op to the server, which has already been received successfully. Do nothing.
      # The op will be confirmed normally when we get the op itself was echoed back from the server
      # (handled below).

    else if (msg.op is undefined and msg.v isnt undefined) or (msg.op and msg.meta.source in @inflightSubmittedIds)
      # Our inflight op has been acknowledged.
      oldInflightOp = @inflightOp
      @inflightOp = null
      @inflightSubmittedIds.length = 0

      error = msg.error
      if error
        # The server has rejected an op from the client for some reason.
        # We'll send the error message to the user and roll back the change.
        #
        # If the server isn't going to allow edits anyway, we should probably
        # figure out some way to flag that (readonly:true in the open request?)

        if @type.invert
          undo = @type.invert oldInflightOp

          # Now we have to transform the undo operation by any server ops & pending ops
          if @pendingOp
            [@pendingOp, undo] = @_xf @pendingOp, undo

          # ... and apply it locally, reverting the changes.
          # 
          # This call will also call @emit 'remoteop'. I'm still not 100% sure about this
          # functionality, because its really a local op. Basically, the problem is that
          # if the client's op is rejected by the server, the editor window should update
          # to reflect the undo.
          @_otApply undo, true
        else
          @emit 'error', "Op apply failed (#{error}) and the op could not be reverted"

        callback error for callback in @inflightCallbacks
      else
        # The op applied successfully.
        throw new Error('Invalid version from server') unless msg.v == @version

        @serverOps[@version] = oldInflightOp
        @version++
        @emit 'acknowledge', oldInflightOp
        callback null, oldInflightOp for callback in @inflightCallbacks

      # Send the next op.
      @flush()

    else if msg.op
      # We got a new op from the server.
      # msg is {doc:, op:, v:}

      # There is a bug in socket.io (produced on firefox 3.6) which causes messages
      # to be duplicated sometimes.
      # We'll just silently drop subsequent messages.
      return if msg.v < @version

      return @emit 'error', "Expected docName '#{@name}' but got #{msg.doc}" unless msg.doc == @name
      return @emit 'error', "Expected version #{@version} but got #{msg.v}" unless msg.v == @version

  #    p "if: #{i @inflightOp} pending: #{i @pendingOp} doc '#{@snapshot}' op: #{i msg.op}"

      op = msg.op
      @serverOps[@version] = op

      docOp = op
      if @inflightOp != null
        [@inflightOp, docOp] = @_xf @inflightOp, docOp
      if @pendingOp != null
        [@pendingOp, docOp] = @_xf @pendingOp, docOp
        
      @version++
      # Finally, apply the op to @snapshot and trigger any event listeners
      @_otApply docOp, true

    else if msg.meta
      {path, value} = msg.meta

      switch path?[0]
        when 'shout'
          return @emit 'shout', value
        else
          console?.warn 'Unhandled meta op:', msg

    else
      console?.warn 'Unhandled document message:', msg


  # Send ops to the server, if appropriate.
  #
  # Only one op can be in-flight at a time, so if an op is already on its way then
  # this method does nothing.
  flush: =>
    delete @flushTimeout
    #console.log "CALLED FLUSH"

    return unless @connection.state == 'ok' and @inflightOp == null and @pendingOp != null

    # Rotate null -> pending -> inflight
    @inflightOp = @pendingOp
    @inflightCallbacks = @pendingCallbacks

    @pendingOp = null
    @pendingCallbacks = []

    #console.log "SENDING OP TO SERVER", @inflightOp, @version
    @connection.send {doc:@name, op:@inflightOp, v:@version}

  # Submit an op to the server. The op maybe held for a little while before being sent, as only one
  # op can be inflight at any time.
  submitOp: (op, callback) ->
    op = @type.normalize(op) if @type.normalize?

    # If this throws an exception, no changes should have been made to the doc
    @snapshot = @type.apply @snapshot, op

    if @pendingOp != null
      @pendingOp = @type.compose(@pendingOp, op)
    else
      @pendingOp = op

    @pendingCallbacks.push callback if callback

    @emit 'change', op

    # A timeout is used so if the user sends multiple ops at the same time, they'll be composed
    # & sent together.
    if !@flushTimeout?
        @flushTimeout = setTimeout @flush, @_flushDelay || 0
  
  setFlushDelay: (delay) =>
      @_flushDelay = delay
  
  shout: (msg) =>
    # Meta ops don't have to queue, they can go direct. Good/bad idea?
    @connection.send {doc:@name, meta: { path: ['shout'], value: msg } }
  
  # Open a document. The document starts closed.
  open: (callback) ->
    @autoOpen = true
    return unless @state is 'closed'

    message =
      doc: @name
      open: true

    message.snapshot = null if @snapshot is undefined
    message.type = @type.name if @type
    message.v = @version if @version?
    message.create = true if @_create

    @connection.send message

    @state = 'opening'

    @_openCallback = (error) =>
      @_openCallback = null
      callback? error

  # Close a document.
  close: (callback) ->
    @autoOpen = false
    return callback?() if @state is 'closed'

    @connection.send {doc:@name, open:false}

    # Should this happen immediately or when we get open:false back from the server?
    @state = 'closed'

    @emit 'closing'
    @_closeCallback = callback
 
# Make documents event emitters
unless WEB?
  MicroEvent = require './microevent'

MicroEvent.mixin Doc

exports.Doc = Doc
