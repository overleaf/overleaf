define(['base'], function(App) {
  App.directive('autoSubmitForm', function() {
    return {
      link(scope, element) {
        element.submit() // Runs on load
      }
    }
  })
})
