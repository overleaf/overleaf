# API for JSON OT

json = require './json' if typeof WEB is 'undefined'

if WEB?
  extendDoc = exports.extendDoc
  exports.extendDoc = (name, fn) ->
    SubDoc::[name] = fn
    extendDoc name, fn

depath = (path) ->
  if path.length == 1 and path[0].constructor == Array
    path[0]
  else path

class SubDoc
  constructor: (@doc, @path) ->
  at: (path...) -> @doc.at @path.concat depath path
  get: -> @doc.getAt @path
  # for objects and lists
  set: (value, cb) -> @doc.setAt @path, value, cb
  # for strings and lists.
  insert: (pos, value, cb) -> @doc.insertAt @path, pos, value, cb
  # for strings
  del: (pos, length, cb) -> @doc.deleteTextAt @path, length, pos, cb
  # for objects and lists
  remove: (cb) -> @doc.removeAt @path, cb
  push: (value, cb) -> @insert @get().length, value, cb
  move: (from, to, cb) -> @doc.moveAt @path, from, to, cb
  add: (amount, cb) -> @doc.addAt @path, amount, cb
  on: (event, cb) -> @doc.addListener @path, event, cb
  removeListener: (l) -> @doc.removeListener l

  # text API compatibility
  getLength: -> @get().length
  getText: -> @get()

traverse = (snapshot, path) ->
  container = data:snapshot
  key = 'data'
  elem = container
  for p in path
    elem = elem[key]
    key = p
    throw new Error 'bad path' if typeof elem == 'undefined'
  {elem, key}

pathEquals = (p1, p2) ->
  return false if p1.length != p2.length
  for e,i in p1
    return false if e != p2[i]
  true

json.api =
  provides: {json:true}

  at: (path...) -> new SubDoc this, depath path

  get: -> @snapshot
  set: (value, cb) -> @setAt [], value, cb

  getAt: (path) ->
    {elem, key} = traverse @snapshot, path
    return elem[key]

  setAt: (path, value, cb) ->
    {elem, key} = traverse @snapshot, path
    op = {p:path}
    if elem.constructor == Array
      op.li = value
      op.ld = elem[key] if typeof elem[key] != 'undefined'
    else if typeof elem == 'object'
      op.oi = value
      op.od = elem[key] if typeof elem[key] != 'undefined'
    else throw new Error 'bad path'
    @submitOp [op], cb

  removeAt: (path, cb) ->
    {elem, key} = traverse @snapshot, path
    throw new Error 'no element at that path' unless typeof elem[key] != 'undefined'
    op = {p:path}
    if elem.constructor == Array
      op.ld = elem[key]
    else if typeof elem == 'object'
      op.od = elem[key]
    else throw new Error 'bad path'
    @submitOp [op], cb

  insertAt: (path, pos, value, cb) ->
    {elem, key} = traverse @snapshot, path
    op = {p:path.concat pos}
    if elem[key].constructor == Array
      op.li = value
    else if typeof elem[key] == 'string'
      op.si = value
    @submitOp [op], cb

  moveAt: (path, from, to, cb) ->
    op = [{p:path.concat(from), lm:to}]
    @submitOp op, cb

  addAt: (path, amount, cb) ->
    op = [{p:path, na:amount}]
    @submitOp op, cb

  deleteTextAt: (path, length, pos, cb) ->
    {elem, key} = traverse @snapshot, path
    op = [{p:path.concat(pos), sd:elem[key][pos...(pos + length)]}]
    @submitOp op, cb

  addListener: (path, event, cb) ->
    l = {path, event, cb}
    @_listeners.push l
    l
  removeListener: (l) ->
    i = @_listeners.indexOf l
    return false if i < 0
    @_listeners.splice i, 1
    return true
  _register: ->
    @_listeners = []
    @on 'change', (op) ->
      for c in op
        if c.na != undefined or c.si != undefined or c.sd != undefined
          # no change to structure
          continue
        to_remove = []
        for l, i in @_listeners
          # Transform a dummy op by the incoming op to work out what
          # should happen to the listener.
          dummy = {p:l.path, na:0}
          xformed = @type.transformComponent [], dummy, c, 'left'
          if xformed.length == 0
            # The op was transformed to noop, so we should delete the listener.
            to_remove.push i
          else if xformed.length == 1
            # The op remained, so grab its new path into the listener.
            l.path = xformed[0].p
          else
            throw new Error "Bad assumption in json-api: xforming an 'si' op will always result in 0 or 1 components."
        to_remove.sort (a, b) -> b - a
        for i in to_remove
          @_listeners.splice i, 1
    @on 'remoteop', (op) ->
      for c in op
        match_path = if c.na == undefined then c.p[...c.p.length-1] else c.p
        for {path, event, cb} in @_listeners
          if pathEquals path, match_path
            switch event
              when 'insert'
                if c.li != undefined and c.ld == undefined
                  cb(c.p[c.p.length-1], c.li)
                else if c.oi != undefined and c.od == undefined
                  cb(c.p[c.p.length-1], c.oi)
                else if c.si != undefined
                  cb(c.p[c.p.length-1], c.si)
              when 'delete'
                if c.li == undefined and c.ld != undefined
                  cb(c.p[c.p.length-1], c.ld)
                else if c.oi == undefined and c.od != undefined
                  cb(c.p[c.p.length-1], c.od)
                else if c.sd != undefined
                  cb(c.p[c.p.length-1], c.sd)
              when 'replace'
                if c.li != undefined and c.ld != undefined
                  cb(c.p[c.p.length-1], c.ld, c.li)
                else if c.oi != undefined and c.od != undefined
                  cb(c.p[c.p.length-1], c.od, c.oi)
              when 'move'
                if c.lm != undefined
                  cb(c.p[c.p.length-1], c.lm)
              when 'add'
                if c.na != undefined
                  cb(c.na)
          else if (common = @type.commonPath match_path, path)?
            if event == 'child op'
              if match_path.length == path.length == common
                throw new Error "paths match length and have commonality, but aren't equal?"
              child_path = c.p[common+1..]
              cb(child_path, c)
