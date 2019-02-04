define(['ace/ace', 'ace/ext-searchbox'], function() {
  const SearchBox = ace.require('ace/ext/searchbox')

  class GlobalKeybindingAdapter {
    constructor(editor) {
      this.editor = editor
    }

    handleF(e) {
      e.preventDefault()
      SearchBox.Search(this.editor, true)
      return false
    }
  }

  return GlobalKeybindingAdapter
})
