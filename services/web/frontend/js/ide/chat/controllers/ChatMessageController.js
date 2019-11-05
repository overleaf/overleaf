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
define(['base', 'ide/colors/ColorManager'], (App, ColorManager) =>
  App.controller('ChatMessageController', function($scope, ide) {
    const hslColorConfigs = {
      borderSaturation:
        (window.uiConfig != null
          ? window.uiConfig.chatMessageBorderSaturation
          : undefined) || '70%',
      borderLightness:
        (window.uiConfig != null
          ? window.uiConfig.chatMessageBorderLightness
          : undefined) || '70%',
      bgSaturation:
        (window.uiConfig != null
          ? window.uiConfig.chatMessageBgSaturation
          : undefined) || '60%',
      bgLightness:
        (window.uiConfig != null
          ? window.uiConfig.chatMessageBgLightness
          : undefined) || '97%'
    }

    const hue = function(user) {
      if (user == null) {
        return 0
      } else {
        return ColorManager.getHueForUserId(user.id)
      }
    }

    $scope.getMessageStyle = user => ({
      'border-color': `hsl(${hue(user)}, ${hslColorConfigs.borderSaturation}, ${
        hslColorConfigs.borderLightness
      })`,
      'background-color': `hsl(${hue(user)}, ${hslColorConfigs.bgSaturation}, ${
        hslColorConfigs.bgLightness
      })`
    })

    return ($scope.getArrowStyle = user => ({
      'border-color': `hsl(${hue(user)}, ${hslColorConfigs.borderSaturation}, ${
        hslColorConfigs.borderLightness
      })`
    }))
  }))
