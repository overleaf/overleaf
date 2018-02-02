# This is some utility code to connect an ace editor to a sharejs document.

Range = ace.require("ace/range").Range

# Convert an ace delta into an op understood by share.js
applyAceToShareJS = (editorDoc, delta, doc, fromUndo) ->
  # Get the start position of the range, in no. of characters
  getStartOffsetPosition = (start) ->
    # This is quite inefficient - getLines makes a copy of the entire
    # lines array in the document. It would be nice if we could just
    # access them directly.
    lines = editorDoc.getLines 0, start.row
      
    offset = 0

    for line, i in lines
      offset += if i < start.row
        line.length
      else
        start.column

    # Add the row number to include newlines.
    offset + start.row

  pos = getStartOffsetPosition(delta.start)

  switch delta.action
    when 'insert'
      text = delta.lines.join('\n')
      doc.insert pos, text, fromUndo
      
    when 'remove'
      text = delta.lines.join('\n')
      doc.del pos, text.length, fromUndo

    else throw new Error "unknown action: #{delta.action}"
  
  return

# Attach an ace editor to the document. The editor's contents are replaced
# with the document's contents unless keepEditorContents is true. (In which case the document's
# contents are nuked and replaced with the editor's).
window.sharejs.extendDoc 'attach_ace', (editor, keepEditorContents, maxDocLength) ->
  throw new Error 'Only text documents can be attached to ace' unless @provides['text']

  doc = this
  editorDoc = editor.getSession().getDocument()
  editorDoc.setNewLineMode 'unix'

  check = ->
    window.setTimeout ->
        editorText = editorDoc.getValue()
        otText = doc.getText()

        if editorText != otText
          console.error "Text does not match!"
          console.error "editor: #{editorText}"
          console.error "ot:     #{otText}"
          # Should probably also replace the editor text with the doc snapshot.
      , 0

  if keepEditorContents
    doc.del 0, doc.getText().length
    doc.insert 0, editorDoc.getValue()
  else
    editorDoc.setValue doc.getText()

  check()

  # When we apply ops from sharejs, ace emits edit events. We need to ignore those
  # to prevent an infinite typing loop.
  suppress = false
  
  # Listen for edits in ace
  editorListener = (change) ->
    return if suppress
    
    if maxDocLength? and editorDoc.getValue().length > maxDocLength
        doc.emit "error", new Error("document length is greater than maxDocLength")
        return

    fromUndo = !!(editor.getSession().$fromUndo or editor.getSession().$fromReject)
    
    applyAceToShareJS editorDoc, change, doc, fromUndo

    check()

  editorDoc.on 'change', editorListener

  # Listen for remote ops on the sharejs document
  docListener = (op) ->
    suppress = true
    applyToDoc editorDoc, op
    suppress = false

    check()


  # Horribly inefficient.
  offsetToPos = (offset) ->
    # Again, very inefficient.
    lines = editorDoc.getAllLines()

    row = 0
    for line, row in lines
      break if offset <= line.length

      # +1 for the newline.
      offset -= lines[row].length + 1

    row:row, column:offset

  # We want to insert a remote:true into the delta if the op comes from the
  # underlying sharejs doc (which means it is from a remote op), so we have to do
  # the work of editorDoc.insert and editorDoc.remove manually. These methods are
  # copied from ace.js doc#insert and #remove, and then inject the remote:true
  # flag into the delta.
  doc.on 'insert', (pos, text) ->
    if (editorDoc.getLength() <= 1)
        editorDoc.$detectNewLine(text)

    lines = editorDoc.$split(text)
    position = offsetToPos(pos)
    start = editorDoc.clippedPos(position.row, position.column)
    end = {
        row: start.row + lines.length - 1,
        column: (if lines.length == 1 then start.column else 0) + lines[lines.length - 1].length
    }

    suppress = true
    editorDoc.applyDelta({
        start: start,
        end: end,
        action: "insert",
        lines: lines,
        remote: true
    });
    suppress = false
    check()

  doc.on 'delete', (pos, text) ->
    range = Range.fromPoints offsetToPos(pos), offsetToPos(pos + text.length)
    start = editorDoc.clippedPos(range.start.row, range.start.column)
    end = editorDoc.clippedPos(range.end.row, range.end.column)
    suppress = true
    editorDoc.applyDelta({
        start: start,
        end: end,
        action: "remove",
        lines: editorDoc.getLinesForRange({start: start, end: end})
        remote: true
    });
    suppress = false
    check()

  doc.detach_ace = ->
    doc.removeListener 'remoteop', docListener
    editorDoc.removeListener 'change', editorListener
    delete doc.detach_ace

  return

