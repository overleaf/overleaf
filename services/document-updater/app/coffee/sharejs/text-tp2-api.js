# Text document API for text-tp2

if WEB?
  type = exports.types['text-tp2']
else
  type = require './text-tp2'

{_takeDoc:takeDoc, _append:append} = type

appendSkipChars = (op, doc, pos, maxlength) ->
  while (maxlength == undefined || maxlength > 0) and pos.index < doc.data.length
    part = takeDoc doc, pos, maxlength, true
    maxlength -= part.length if maxlength != undefined and typeof part is 'string'
    append op, (part.length || part)

type['api'] =
  'provides': {'text':true}

  # The number of characters in the string
  'getLength': -> @snapshot.charLength

  # Flatten a document into a string
  'getText': ->
    strings = (elem for elem in @snapshot.data when typeof elem is 'string')
    strings.join ''

  'insert': (pos, text, callback) ->
    pos = 0 if pos == undefined

    op = []
    docPos = {index:0, offset:0}

    appendSkipChars op, @snapshot, docPos, pos
    append op, {'i':text}
    appendSkipChars op, @snapshot, docPos
    
    @submitOp op, callback
    op
  
  'del': (pos, length, callback) ->
    op = []
    docPos = {index:0, offset:0}

    appendSkipChars op, @snapshot, docPos, pos
    
    while length > 0
      part = takeDoc @snapshot, docPos, length, true
      if typeof part is 'string'
        append op, {'d':part.length}
        length -= part.length
      else
        append op, part
    
    appendSkipChars op, @snapshot, docPos

    @submitOp op, callback
    op

  '_register': ->
    # Interpret recieved ops + generate more detailed events for them
    @on 'remoteop', (op, snapshot) ->
      textPos = 0
      docPos = {index:0, offset:0}

      for component in op
        if typeof component is 'number'
          # Skip
          remainder = component
          while remainder > 0
            part = takeDoc snapshot, docPos, remainder
            if typeof part is 'string'
              textPos += part.length
            remainder -= part.length || part
        else if component.i != undefined
          # Insert
          if typeof component.i is 'string'
            @emit 'insert', textPos, component.i
            textPos += component.i.length
        else
          # Delete
          remainder = component.d
          while remainder > 0
            part = takeDoc snapshot, docPos, remainder
            if typeof part is 'string'
              @emit 'delete', textPos, part
            remainder -= part.length || part

      return

