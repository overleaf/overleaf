define(['base'], App =>
  App.controller('UpgradeSubscriptionController', function(
    $scope,
    eventTracking
  ) {
    $scope.upgradeSubscription = function() {
      eventTracking.send('subscription-funnel', 'subscription-page', 'upgrade')
    }
  }))
