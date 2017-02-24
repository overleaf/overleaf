# Text document API for text

text = require './text' if typeof WEB is 'undefined'

text.api =
  provides: {text:true}

  # The number of characters in the string
  getLength: -> @snapshot.length

  # Get the text contents of a document
  getText: -> @snapshot

  insert: (pos, text, fromUndo, callback) ->
    op = {p:pos, i:text}
    if fromUndo
      op.u = true
    op = [op]
    
    @submitOp op, callback
    op
  
  del: (pos, length, fromUndo, callback) ->
    op = {p:pos, d:@snapshot[pos...(pos + length)]}
    if fromUndo
      op.u = true
    op = [op]

    @submitOp op, callback
    op
  
  _register: ->
    @on 'remoteop', (op) ->
      for component in op
        if component.i != undefined
          @emit 'insert', component.p, component.i
        else if component.d != undefined
          @emit 'delete', component.p, component.d
