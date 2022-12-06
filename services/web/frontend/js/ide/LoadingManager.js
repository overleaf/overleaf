import i18n from '../i18n'

// Control the editor loading screen. We want to show the loading screen until
// both the websocket connection has been established (so that the editor is in
// the correct state) and the translations have been loaded (so we don't see a
// flash of untranslated text).
class LoadingManager {
  constructor($scope) {
    this.$scope = $scope

    const socketPromise = new Promise(resolve => {
      this.resolveSocketPromise = resolve
    })

    Promise.all([socketPromise, i18n])
      .then(() => {
        this.$scope.$apply(() => {
          this.$scope.state.load_progress = 100
          this.$scope.state.loading = false
          this.$scope.$emit('editor:loaded')
        })
      })
      // Note: this will only catch errors in from i18n setup. ConnectionManager
      // handles errors for the socket connection
      .catch(() => {
        this.$scope.$apply(() => {
          this.$scope.state.error = 'Could not load translations.'
        })
      })
  }

  socketLoaded() {
    this.resolveSocketPromise()
  }
}

export default LoadingManager
