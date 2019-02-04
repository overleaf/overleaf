define([], function() {
  const F_KEY = 70

  class GlobalKeyBindingManager {
    constructor(adapter) {
      this.adapter = adapter
      this.handleKey = this.handleKey.bind(this)
    }

    handleKey(e) {
      if (e.metaKey || e.ctrlKey) {
        switch (e.keyCode) {
          case F_KEY:
            return this.adapter.handleF(e)
        }
      }
    }

    init() {
      $(document).on('keydown', this.handleKey)
    }

    tearDown() {
      $(document).off('keydown', this.handleKey)
    }
  }

  return GlobalKeyBindingManager
})
