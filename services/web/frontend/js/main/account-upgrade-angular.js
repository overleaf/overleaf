import App from '../base'
import { startFreeTrial, upgradePlan, paywallPrompt } from './account-upgrade'

App.controller('FreeTrialModalController', [
  '$scope',
  function ($scope) {
    $scope.buttonClass = 'btn-primary'
    $scope.startFreeTrial = (source, version) =>
      startFreeTrial(source, version, $scope)
    $scope.paywallPrompt = source => paywallPrompt(source)
  },
])

App.controller('UpgradeModalController', [
  '$scope',
  function ($scope) {
    $scope.buttonClass = 'btn-primary'
    $scope.upgradePlan = source => upgradePlan(source, $scope)
  },
])
