import App from '../../base'

export default App.controller(
  'UpgradeSubscriptionController',
  function ($scope, eventTracking) {
    $scope.upgradeSubscription = function () {
      eventTracking.send('subscription-funnel', 'subscription-page', 'upgrade')
      eventTracking.sendMB('upgrade-button-click', {
        source: 'subscription-page',
      })
    }
  }
)
