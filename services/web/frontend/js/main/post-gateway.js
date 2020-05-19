import App from '../base'

export default App.controller('PostGatewayController', function($scope) {
  $scope.handleGateway = function() {
    const { params } = JSON.parse($('#gateway-data').text())
    params.viaGateway = 'true'
    Object.keys(params).forEach(param => {
      $('<input>')
        .attr({
          type: 'hidden',
          name: param,
          value: params[param]
        })
        .appendTo('#gateway')
    })
    $('#gateway').submit()
  }
})
