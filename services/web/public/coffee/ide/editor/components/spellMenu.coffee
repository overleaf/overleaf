define ["base"], (App) ->
  App.component "spellMenu", {
    bindings: {
      open: "<"
      top: "<"
      left: "<"
      suggestions: "<"
      replaceWord: "&"
      learnWord: "&"
    }
    template: """
  <div
    class="dropdown context-menu spell-check-menu"
    ng-show="$ctrl.open"
    ng-style="{top: $ctrl.top, left: $ctrl.left}"
    ng-class="{open: $ctrl.open}"
  >
    <ul class="dropdown-menu">
      <li ng-repeat="suggestion in $ctrl.suggestions | limitTo:8">
        <a href ng-click="$ctrl.replaceWord(suggestion)">{{ suggestion }}</a>
      </li>
      <li class="divider"></li>
      <li>
        <a href ng-click="$ctrl.learnWord(suggestion)">Add to Dictionary</a>
      </li>
    </ul>
  </div>
    """
  }