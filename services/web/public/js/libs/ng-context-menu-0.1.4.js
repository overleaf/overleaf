/**
 * ng-context-menu - v0.1.4 - An AngularJS directive to display a context menu when a right-click event is triggered
 *
 * @author Ian Kennington Walter (http://ianvonwalter.com)
 */
angular
  .module('ng-context-menu', [])
  .factory('ContextMenuService', function() {
    return {
      element: null,
      menuElement: null,
      container: null
    };
  })
  .directive('contextMenu', ['$document', 'ContextMenuService', function($document, ContextMenuService) {
    return {
      restrict: 'A',
      scope: {
        'callback': '&contextMenu',
        'disabled': '&contextMenuDisabled'
      },
      link: function($scope, $element, $attrs) {
        var opened = false;

        function open(event, menuElement, container) {
          menuElement.addClass('open');

          if (container) {
            container.append(menuElement);
          }

          var doc = $document[0].documentElement;
          var docLeft = (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0),
            docTop = (window.pageYOffset || doc.scrollTop)  - (doc.clientTop || 0),
            elementHeight = menuElement[0].scrollHeight;
          var docHeight = doc.clientHeight + docTop,
            totalHeight = elementHeight + event.pageY,
            top = Math.max(event.pageY - docTop, 0);

          if (totalHeight > docHeight) {
            top = top - (totalHeight - docHeight);
          }

          menuElement.css('top', top + 'px');
          menuElement.css('left', Math.max(event.pageX - docLeft, 0) + 'px');
          opened = true;
        }

        function close(menuElement) {
          menuElement.removeClass('open');
          opened = false;
        }

        $element.bind('contextmenu', function(event) {
          if (!$scope.disabled()) {
            if (ContextMenuService.menuElement !== null) {
              close(ContextMenuService.menuElement);
            }
            ContextMenuService.menuElement = angular.element(document.getElementById($attrs.target));
            if (typeof($attrs.contextMenuContainer) != "undefined") {
              ContextMenuService.container = angular.element($attrs.contextMenuContainer)
            }
            ContextMenuService.element = event.target;
            console.log('set', ContextMenuService.element);

            event.preventDefault();
            event.stopPropagation();
            $scope.$apply(function() {
              $scope.callback({ $event: event });
              open(event, ContextMenuService.menuElement, ContextMenuService.container);
            });
          }
        });

        function handleKeyUpEvent(event) {
          //console.log('keyup');
          if (!$scope.disabled() && opened && event.keyCode === 27) {
            $scope.$apply(function() {
              close(ContextMenuService.menuElement);
            });
          }
        }

        function handleClickEvent(event) {
          if (!$scope.disabled() &&
            opened &&
            (event.button !== 2 || event.target !== ContextMenuService.element)) {
            $scope.$apply(function() {
              close(ContextMenuService.menuElement);
            });
          }
        }

        $document.bind('keyup', handleKeyUpEvent);
        // Firefox treats a right-click as a click and a contextmenu event while other browsers
        // just treat it as a contextmenu event
        $document.bind('click', handleClickEvent);
        $document.bind('contextmenu', handleClickEvent);

        $scope.$on('$destroy', function() {
          //console.log('destroy');
          $document.unbind('keyup', handleKeyUpEvent);
          $document.unbind('click', handleClickEvent);
          $document.unbind('contextmenu', handleClickEvent);
        });
      }
    };
  }]);
