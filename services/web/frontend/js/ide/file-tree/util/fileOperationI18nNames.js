define([], function() {
  if (window.fileActionI18n !== undefined) {
    return window.fileActionI18n
  }
  return {
    edited: 'edited',
    renamed: 'renamed',
    created: 'created',
    deleted: 'deleted'
  }
})
