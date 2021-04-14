import App from '../base'
import { startFreeTrial, upgradePlan } from './account-upgrade'

App.controller('FreeTrialModalController', function ($scope, eventTracking) {
  $scope.buttonClass = 'btn-primary'
  $scope.startFreeTrial = (source, version) =>
    startFreeTrial(source, version, $scope, eventTracking)
})

App.controller('UpgradeModalController', function ($scope, eventTracking) {
  $scope.buttonClass = 'btn-primary'
  $scope.upgradePlan = source => upgradePlan(source, $scope)
})
