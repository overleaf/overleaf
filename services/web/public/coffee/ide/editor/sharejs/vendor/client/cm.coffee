# This is some utility code to connect a CodeMirror editor
# to a sharejs document.
# It is heavily inspired from the Ace editor hook.

# Convert a CodeMirror delta into an op understood by share.js
applyCMToShareJS = (editorDoc, delta, doc) ->
  # CodeMirror deltas give a text replacement.
  # I tuned this operation a little bit, for speed.
  startPos = 0  # Get character position from # of chars in each line.
  i = 0         # i goes through all lines.

  while i < delta.from.line
    startPos += editorDoc.lineInfo(i).text.length + 1   # Add 1 for '\n'
    i++
  startPos += delta.from.ch

  doc.del startPos, delta.removed.join('\n').length if delta.removed
  doc.insert startPos, delta.text.join('\n') if delta.text

# Attach a CodeMirror editor to the document. The editor's contents are replaced
# with the document's contents unless keepEditorContents is true. (In which case
# the document's contents are nuked and replaced with the editor's).
window.sharejs.extendDoc 'attach_cm', (editor, keepEditorContents) ->
  unless @provides.text
    throw new Error 'Only text documents can be attached to CodeMirror2'

  sharedoc = @
  editorDoc = editor.getDoc()

  check = ->
    window.setTimeout ->
        editorText = editor.getValue()
        otText = sharedoc.getText()

        if editorText != otText
          console.error "Text does not match!"
          console.error "editor: #{editorText}"
          console.error "ot:     #{otText}"
          # Removed editor.setValue here as it would cause recursive loops if
          # consistency check failed - because setting the value would trigger
          # the change event
      , 0

  if keepEditorContents
    @del 0, sharedoc.getText().length
    @insert 0, editor.getValue()
  else
    editor.setValue sharedoc.getText()

  check()

  # When we apply ops from sharejs, CodeMirror emits edit events.
  # We need to ignore those to prevent an infinite typing loop.
  suppress = false

  # Listen for edits in CodeMirror.
  editorListener = (ed, change) ->
    return if suppress
    applyCMToShareJS editorDoc, change, sharedoc
    check()

  editorDoc.on 'change', editorListener

  @on 'insert', (pos, text) ->
    suppress = true
    # All the primitives we need are already in CM's API.
    editor.replaceRange text, editor.posFromIndex(pos)
    suppress = false
    check()

  @on 'delete', (pos, text) ->
    suppress = true
    from = editor.posFromIndex pos
    to = editor.posFromIndex (pos + text.length)
    editor.replaceRange '', from, to
    suppress = false
    check()

  @detach_cm = ->
    # TODO: can we remove the insert and delete event callbacks?
    editorDoc.off 'change', editorListener
    delete @detach_cm

  return

