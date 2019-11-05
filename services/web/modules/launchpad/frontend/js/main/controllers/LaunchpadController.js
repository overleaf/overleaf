/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('LaunchpadController', function($scope, $http, $timeout) {
    $scope.adminUserExists = window.data.adminUserExists
    $scope.ideJsPath = window.data.ideJsPath
    $scope.authMethod = window.data.authMethod

    $scope.createAdminSuccess = null
    $scope.createAdminError = null

    $scope.statusChecks = {
      ideJs: { status: 'inflight', error: null },
      websocket: { status: 'inflight', error: null },
      healthCheck: { status: 'inflight', error: null }
    }

    $scope.testEmail = {
      emailAddress: '',
      inflight: false,
      status: null // | 'ok' | 'success'
    }

    $scope.shouldShowAdminForm = () => !$scope.adminUserExists

    $scope.onCreateAdminSuccess = function(response) {
      const { status } = response
      if (status >= 200 && status < 300) {
        return ($scope.createAdminSuccess = true)
      }
    }

    $scope.onCreateAdminError = () => ($scope.createAdminError = true)

    $scope.sendTestEmail = function() {
      $scope.testEmail.inflight = true
      $scope.testEmail.status = null
      return $http
        .post('/launchpad/send_test_email', {
          email: $scope.testEmail.emailAddress,
          _csrf: window.csrfToken
        })
        .then(function(response) {
          const { status } = response
          $scope.testEmail.inflight = false
          if (status >= 200 && status < 300) {
            return ($scope.testEmail.status = 'ok')
          }
        })
        .catch(function() {
          $scope.testEmail.inflight = false
          return ($scope.testEmail.status = 'error')
        })
    }

    $scope.tryFetchIdeJs = function() {
      $scope.statusChecks.ideJs.status = 'inflight'
      return $timeout(
        () =>
          $http
            .get($scope.ideJsPath)
            .then(function(response) {
              const { status } = response
              if (status >= 200 && status < 300) {
                return ($scope.statusChecks.ideJs.status = 'ok')
              }
            })
            .catch(function(response) {
              const { status } = response
              $scope.statusChecks.ideJs.status = 'error'
              return ($scope.statusChecks.ideJs.error = new Error(
                `Http status: ${status}`
              ))
            }),

        1000
      )
    }

    $scope.tryOpenWebSocket = function() {
      $scope.statusChecks.websocket.status = 'inflight'
      return $timeout(function() {
        if (typeof io === 'undefined' || io === null) {
          $scope.statusChecks.websocket.status = 'error'
          $scope.statusChecks.websocket.error = 'socket.io not loaded'
          return
        }
        const socket = io.connect(
          null,
          {
            reconnect: false,
            'connect timeout': 30 * 1000,
            'force new connection': true
          }
        )

        socket.on('connectionAccepted', function() {
          $scope.statusChecks.websocket.status = 'ok'
          return $scope.$apply(function() {})
        })

        socket.on('connectionRejected', function(err) {
          $scope.statusChecks.websocket.status = 'error'
          $scope.statusChecks.websocket.error = err
          return $scope.$apply(function() {})
        })

        return socket.on('connect_failed', function(err) {
          $scope.statusChecks.websocket.status = 'error'
          $scope.statusChecks.websocket.error = err
          return $scope.$apply(function() {})
        })
      }, 1000)
    }

    $scope.tryHealthCheck = function() {
      $scope.statusChecks.healthCheck.status = 'inflight'
      return $http
        .get('/health_check')
        .then(function(response) {
          const { status } = response
          if (status >= 200 && status < 300) {
            return ($scope.statusChecks.healthCheck.status = 'ok')
          }
        })
        .catch(function(response) {
          const { status } = response
          $scope.statusChecks.healthCheck.status = 'error'
          return ($scope.statusChecks.healthCheck.error = new Error(
            `Http status: ${status}`
          ))
        })
    }

    $scope.runStatusChecks = function() {
      $timeout(() => $scope.tryFetchIdeJs(), 1000)
      return $timeout(() => $scope.tryOpenWebSocket(), 2000)
    }

    // kick off the status checks on load
    if ($scope.adminUserExists) {
      return $scope.runStatusChecks()
    }
  }))
