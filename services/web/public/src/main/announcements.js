/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('AnnouncementsController', function(
    $scope,
    $http,
    event_tracking,
    $window,
    _
  ) {
    $scope.announcements = []
    $scope.ui = {
      isOpen: false,
      newItems: 0
    }

    const refreshAnnouncements = () =>
      $http.get('/announcements').then(function(response) {
        $scope.announcements = response.data
        return ($scope.ui.newItems = _.filter(
          $scope.announcements,
          announcement => !announcement.read
        ).length)
      })

    const markAnnouncementsAsRead = () =>
      event_tracking.sendMB('announcement-alert-dismissed', {
        blogPostId: $scope.announcements[0].id
      })

    $scope.logAnnouncementClick = () =>
      event_tracking.sendMB('announcement-read-more-clicked', {
        blogPostId: $scope.announcements[0].id
      })

    refreshAnnouncements()

    $scope.toggleAnnouncementsUI = function() {
      $scope.ui.isOpen = !$scope.ui.isOpen

      if (!$scope.ui.isOpen && $scope.ui.newItems) {
        $scope.ui.newItems = 0
        return markAnnouncementsAsRead()
      }
    }

    return ($scope.showAll = () => ($scope.ui.newItems = 0))
  }))
