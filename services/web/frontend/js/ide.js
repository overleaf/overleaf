/* eslint-disable
    camelcase,
    max-len,
    no-cond-assign,
    no-return-assign,
    no-unused-vars,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from './base'
import FileTreeManager from './ide/file-tree/FileTreeManager'
import LoadingManager from './ide/LoadingManager'
import ConnectionManager from './ide/connection/ConnectionManager'
import EditorManager from './ide/editor/EditorManager'
import OnlineUsersManager from './ide/online-users/OnlineUsersManager'
import PermissionsManager from './ide/permissions/PermissionsManager'
import BinaryFilesManager from './ide/binary-files/BinaryFilesManager'
import ReferencesManager from './ide/references/ReferencesManager'
import MetadataManager from './ide/metadata/MetadataManager'
import './ide/review-panel/ReviewPanelManager'
import './ide/cobranding/CobrandingDataService'
import './ide/chat/index'
import './ide/file-view/index'
import './ide/toolbar/index'
import './ide/directives/layout'
import './ide/directives/verticalResizablePanes'
import './ide/services/ide'
import './services/queued-http' // used in FileTreeManager
import './main/event' // used in various controllers
import './main/system-messages' // used in project/editor
import '../../modules/modules-ide'
import './features/source-editor/ide'
import './shared/context/controllers/root-context-controller'
import './features/editor-navigation-toolbar/controllers/editor-navigation-toolbar-controller'
import './features/pdf-preview/controllers/pdf-preview-controller'
import './features/share-project-modal/controllers/react-share-project-modal-controller'
import './features/source-editor/controllers/grammarly-advert-controller'
import './features/history/controllers/history-controller'
import './features/editor-left-menu/controllers/editor-left-menu-controller'
import './features/outline/controllers/outline-controller'
import { cleanupServiceWorker } from './utils/service-worker-cleanup'
import { reportCM6Perf } from './infrastructure/cm6-performance'
import { debugConsole } from '@/utils/debugging'

App.controller('IdeController', [
  '$scope',
  '$timeout',
  'ide',
  'localStorage',
  'eventTracking',
  'metadata',
  'CobrandingDataService',
  '$window',
  function (
    $scope,
    $timeout,
    ide,
    localStorage,
    eventTracking,
    metadata,
    CobrandingDataService,
    $window
  ) {
    // Don't freak out if we're already in an apply callback
    let err, pdfLayout, userAgent
    $scope.$originalApply = $scope.$apply
    $scope.$apply = function (fn) {
      if (fn == null) {
        fn = function () {}
      }
      const phase = this.$root.$$phase
      if (phase === '$apply' || phase === '$digest') {
        return fn()
      } else {
        return this.$originalApply(fn)
      }
    }

    $scope.state = {
      loading: true,
      load_progress: 40,
      error: null,
    }
    $scope.ui = {
      leftMenuShown: false,
      view: 'editor',
      chatOpen: false,
      pdfLayout: 'sideBySide',
      pdfHidden: false,
      pdfWidth: 0,
      reviewPanelOpen: localStorage(`ui.reviewPanelOpen.${window.project_id}`),
      miniReviewPanelVisible: false,
      chatResizerSizeOpen: 7,
      chatResizerSizeClosed: 0,
    }
    $scope.user = window.user

    $scope.settings = window.userSettings
    $scope.anonymous = window.anonymous
    $scope.isTokenMember = window.isTokenMember
    $scope.isRestrictedTokenMember = window.isRestrictedTokenMember

    $scope.cobranding = {
      isProjectCobranded: CobrandingDataService.isProjectCobranded(),
      logoImgUrl: CobrandingDataService.getLogoImgUrl(),
      submitBtnHtml: CobrandingDataService.getSubmitBtnHtml(),
      brandVariationName: CobrandingDataService.getBrandVariationName(),
      brandVariationHomeUrl: CobrandingDataService.getBrandVariationHomeUrl(),
    }

    $scope.chat = {}

    ide.toggleReviewPanel = $scope.toggleReviewPanel = function () {
      $scope.$applyAsync(() => {
        if (!$scope.project.features.trackChangesVisible) {
          return
        }
        $scope.ui.reviewPanelOpen = !$scope.ui.reviewPanelOpen
        eventTracking.sendMB('rp-toggle-panel', {
          value: $scope.ui.reviewPanelOpen,
        })
      })
    }

    $scope.$watch('ui.reviewPanelOpen', function (value) {
      if (value != null) {
        return localStorage(`ui.reviewPanelOpen.${window.project_id}`, value)
      }
    })

    $scope.$on('layout:pdf:resize', function (_, layoutState) {
      $scope.ui.pdfHidden = layoutState.east.initClosed
      return ($scope.ui.pdfWidth = layoutState.east.size)
    })

    $scope.$watch('ui.view', function (newView, oldView) {
      if (newView !== oldView) {
        $scope.$broadcast('layout:flat-screen:toggle')
      }
      if (newView != null && newView !== 'editor' && newView !== 'pdf') {
        eventTracking.sendMBOnce(`ide-open-view-${newView}-once`)
      }
    })

    $scope.$watch('ui.chatOpen', function (isOpen) {
      if (isOpen) {
        eventTracking.sendMBOnce('ide-open-chat-once')
      }
    })

    $scope.$watch('ui.leftMenuShown', function (isOpen) {
      if (isOpen) {
        eventTracking.sendMBOnce('ide-open-left-menu-once')
      }
    })

    $scope.trackHover = feature => {
      eventTracking.sendMBOnce(`ide-hover-${feature}-once`)
    }
    // End of tracking code.

    window._ide = ide

    ide.validFileRegex = '^[^*/]*$' // Don't allow * and /

    ide.project_id = $scope.project_id = window.project_id
    ide.$scope = $scope

    ide.referencesSearchManager = new ReferencesManager(ide, $scope)
    ide.loadingManager = new LoadingManager($scope)
    ide.connectionManager = new ConnectionManager(ide, $scope)
    ide.fileTreeManager = new FileTreeManager(ide, $scope)
    ide.editorManager = new EditorManager(
      ide,
      $scope,
      localStorage,
      eventTracking
    )
    ide.onlineUsersManager = new OnlineUsersManager(ide, $scope)
    ide.permissionsManager = new PermissionsManager(ide, $scope)
    ide.binaryFilesManager = new BinaryFilesManager(ide, $scope)
    ide.metadataManager = new MetadataManager(ide, $scope, metadata)

    let inited = false
    $scope.$on('project:joined', function () {
      if (inited) {
        return
      }
      inited = true
      if (
        __guard__(
          $scope != null ? $scope.project : undefined,
          x => x.deletedByExternalDataSource
        )
      ) {
        ide.showGenericMessageModal(
          'Project Renamed or Deleted',
          `\
This project has either been renamed or deleted by an external data source such as Dropbox.
We don't want to delete your data on Overleaf, so this project still contains your history and collaborators.
If the project has been renamed please look in your project list for a new project under the new name.\
`
        )
      }
      return $timeout(function () {
        if ($scope.permissions.write) {
          let _labelsInitialLoadDone
          ide.metadataManager.loadProjectMetaFromServer()
          return (_labelsInitialLoadDone = true)
        }
      }, 200)
    })

    // Count the first 'doc:opened' as a sign that the ide is loaded
    // and broadcast a message. This is a good event to listen for
    // if you want to wait until the ide is fully loaded and initialized
    let _loaded = false
    $scope.$on('doc:opened', function () {
      if (_loaded) {
        return
      }
      $scope.$broadcast('ide:loaded')
      return (_loaded = true)
    })

    ide.editingSessionHeartbeat = () => {
      eventTracking.editingSessionHeartbeat(() => {
        const editorType = ide.editorManager.getEditorType()

        const segmentation = {
          editorType,
        }

        if (editorType === 'cm6' || editorType === 'cm6-rich-text') {
          const cm6PerfData = reportCM6Perf()

          // Ignore if no typing has happened
          if (cm6PerfData.numberOfEntries > 0) {
            const perfProps = [
              'Max',
              'Mean',
              'Median',
              'NinetyFifthPercentile',
              'DocLength',
              'NumberOfEntries',
              'MaxUserEventsBetweenDomUpdates',
              'Grammarly',
              'SessionLength',
              'Memory',
              'Lags',
              'NonLags',
              'LongestLag',
              'MeanLagsPerMeasure',
              'MeanKeypressesPerMeasure',
              'MeanKeypressPaint',
              'LongTasks',
              'Release',
            ]

            for (const prop of perfProps) {
              const perfValue =
                cm6PerfData[prop.charAt(0).toLowerCase() + prop.slice(1)]
              if (perfValue !== null) {
                segmentation['cm6Perf' + prop] = perfValue
              }
            }
          }
        }

        return segmentation
      })
    }

    $scope.$on('cursor:editor:update', () => {
      ide.editingSessionHeartbeat()
    })
    $scope.$on('scroll:editor:update', () => {
      ide.editingSessionHeartbeat()
    })

    angular.element($window).on('click', ide.editingSessionHeartbeat)

    $scope.$on('$destroy', () =>
      angular.element($window).off('click', ide.editingSessionHeartbeat)
    )

    const DARK_THEMES = [
      'ambiance',
      'chaos',
      'clouds_midnight',
      'cobalt',
      'idle_fingers',
      'merbivore',
      'merbivore_soft',
      'mono_industrial',
      'monokai',
      'pastel_on_dark',
      'solarized_dark',
      'terminal',
      'tomorrow_night',
      'tomorrow_night_blue',
      'tomorrow_night_bright',
      'tomorrow_night_eighties',
      'twilight',
      'vibrant_ink',
    ]
    $scope.darkTheme = false
    // Listen for settings change from React
    window.addEventListener('settings:change', event => {
      $scope.darkTheme = DARK_THEMES.includes(event.detail.editorTheme)
    })

    ide.localStorage = localStorage

    $scope.switchToFlatLayout = function (view) {
      $scope.ui.pdfLayout = 'flat'
      $scope.ui.view = view
      return ide.localStorage('pdf.layout', 'flat')
    }

    $scope.switchToSideBySideLayout = function (view) {
      $scope.ui.pdfLayout = 'sideBySide'
      $scope.ui.view = view
      return localStorage('pdf.layout', 'split')
    }

    if ((pdfLayout = localStorage('pdf.layout'))) {
      if (pdfLayout === 'split') {
        $scope.switchToSideBySideLayout()
      }
      if (pdfLayout === 'flat') {
        $scope.switchToFlatLayout()
      }
    } else {
      $scope.switchToSideBySideLayout()
    }

    // Update ui.pdfOpen when the layout changes.
    // The east pane should open when the layout changes from "Editor only" or "PDF only" to "Editor & PDF".
    $scope.$watch('ui.pdfLayout', value => {
      $scope.ui.pdfOpen = value === 'sideBySide'
    })

    // Update ui.pdfLayout when the east pane is toggled.
    // The layout should be set to "Editor & PDF" (sideBySide) when the east pane is opened, and "Editor only" (flat) when the east pane is closed.
    $scope.$watch('ui.pdfOpen', value => {
      $scope.ui.pdfLayout = value ? 'sideBySide' : 'flat'
      if (value) {
        window.dispatchEvent(new CustomEvent('ui:pdf-open'))
      }
    })

    $scope.handleKeyDown = () => {
      // unused?
    }

    // User can append ?ft=somefeature to url to activate a feature toggle
    ide.featureToggle = __guard__(
      __guard__(
        typeof location !== 'undefined' && location !== null
          ? location.search
          : undefined,
        x1 => x1.match(/^\?ft=(\w+)$/)
      ),
      x => x[1]
    )

    // Listen for editor:lint event from CM6 linter
    window.addEventListener('editor:lint', event => {
      $scope.hasLintingError = event.detail.hasLintingError
    })

    ide.socket.on('project:access:revoked', () => {
      ide.showGenericMessageModal(
        'Removed From Project',
        'You have been removed from this project, and will no longer have access to it. You will be redirected to your project dashboard momentarily.'
      )
    })

    return ide.socket.on('project:publicAccessLevel:changed', data => {
      if (data.newAccessLevel != null) {
        ide.$scope.project.publicAccesLevel = data.newAccessLevel
        return $scope.$digest()
      }
    })
  },
])

cleanupServiceWorker()

angular.module('OverleafApp').config([
  '$provide',
  function ($provide) {
    $provide.decorator('$browser', [
      '$delegate',
      function ($delegate) {
        $delegate.onUrlChange = function () {}
        $delegate.url = function () {
          return ''
        }
        return $delegate
      },
    ])
  },
])

export default angular.bootstrap(document.body, ['OverleafApp'])

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
