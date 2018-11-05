/* eslint-disable
    max-len,
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
  App.component('spellMenu', {
    bindings: {
      open: '<',
      top: '<',
      left: '<',
      layoutFromBottom: '<',
      highlight: '<',
      replaceWord: '&',
      learnWord: '&'
    },
    template: `\
<div
  class="dropdown context-menu spell-check-menu"
  ng-show="$ctrl.open"
  ng-style="{top: $ctrl.top, left: $ctrl.left}"
  ng-class="{open: $ctrl.open, 'spell-check-menu-from-bottom': $ctrl.layoutFromBottom}"
>
  <ul class="dropdown-menu">
    <li ng-repeat="suggestion in $ctrl.highlight.suggestions | limitTo:8">
      <a
        href
        ng-click="$ctrl.replaceWord({ highlight: $ctrl.highlight, suggestion: suggestion })"
      >
        {{ suggestion }}
      </a>
    </li>
    <li class="divider"></li>
    <li>
      <a href ng-click="$ctrl.learnWord({ highlight: $ctrl.highlight })">Add to Dictionary</a>
    </li>
  </ul>
</div>\
`
  }))
