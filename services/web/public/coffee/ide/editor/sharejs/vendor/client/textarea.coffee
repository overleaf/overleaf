# Create an op which converts oldval -> newval.
#
# This function should be called every time the text element is changed. Because changes are
# always localised, the diffing is quite easy.
#
# This algorithm is O(N), but I suspect you could speed it up somehow using regular expressions.
applyChange = (doc, oldval, newval) ->
  return if oldval == newval
  commonStart = 0
  commonStart++ while oldval.charAt(commonStart) == newval.charAt(commonStart)

  commonEnd = 0
  commonEnd++ while oldval.charAt(oldval.length - 1 - commonEnd) == newval.charAt(newval.length - 1 - commonEnd) and
    commonEnd + commonStart < oldval.length and commonEnd + commonStart < newval.length

  doc.del commonStart, oldval.length - commonStart - commonEnd unless oldval.length == commonStart + commonEnd
  doc.insert commonStart, newval[commonStart ... newval.length - commonEnd] unless newval.length == commonStart + commonEnd

window.sharejs.extendDoc 'attach_textarea', (elem) ->
  doc = this
  elem.value = @getText()
  prevvalue = elem.value

  replaceText = (newText, transformCursor) ->
    newSelection = [
      transformCursor elem.selectionStart
      transformCursor elem.selectionEnd
    ]

    scrollTop = elem.scrollTop
    elem.value = newText
    elem.scrollTop = scrollTop if elem.scrollTop != scrollTop
    [elem.selectionStart, elem.selectionEnd] = newSelection

  @on 'insert', (pos, text) ->
    transformCursor = (cursor) ->
      if pos < cursor
        cursor + text.length
      else
        cursor
    #for IE8 and Opera that replace \n with \r\n.
    prevvalue = elem.value.replace /\r\n/g, '\n'
    replaceText prevvalue[...pos] + text + prevvalue[pos..], transformCursor
  
  @on 'delete', (pos, text) ->
    transformCursor = (cursor) ->
      if pos < cursor
        cursor - Math.min(text.length, cursor - pos)
      else
        cursor
    #for IE8 and Opera that replace \n with \r\n.
    prevvalue = elem.value.replace /\r\n/g, '\n'
    replaceText prevvalue[...pos] + prevvalue[pos + text.length..], transformCursor

  genOp = (event) ->
    onNextTick = (fn) -> setTimeout fn, 0
    onNextTick ->
      if elem.value != prevvalue
        # IE constantly replaces unix newlines with \r\n. ShareJS docs
        # should only have unix newlines.
        prevvalue = elem.value
        applyChange doc, doc.getText(), elem.value.replace /\r\n/g, '\n'

  for event in ['textInput', 'keydown', 'keyup', 'select', 'cut', 'paste']
    if elem.addEventListener
      elem.addEventListener event, genOp, false
    else
      elem.attachEvent 'on'+event, genOp

