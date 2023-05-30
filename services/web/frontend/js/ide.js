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
import HistoryManager from './ide/history/HistoryManager'
import HistoryV2Manager from './ide/history/HistoryV2Manager'
import PermissionsManager from './ide/permissions/PermissionsManager'
import BinaryFilesManager from './ide/binary-files/BinaryFilesManager'
import ReferencesManager from './ide/references/ReferencesManager'
import MetadataManager from './ide/metadata/MetadataManager'
import './ide/review-panel/ReviewPanelManager'
import OutlineManager from './features/outline/outline-manager'
import SafariScrollPatcher from './ide/SafariScrollPatcher'
import './ide/cobranding/CobrandingDataService'
import './ide/settings/index'
import './ide/chat/index'
import './ide/clone/index'
import './ide/file-view/index'
import './ide/hotkeys/index'
import './ide/wordcount/index'
import './ide/directives/layout'
import './ide/directives/validFile'
import './ide/directives/verticalResizablePanes'
import './ide/services/ide'
import './directives/focus'
import './directives/fineUpload'
import './directives/scroll'
import './directives/onEnter'
import './directives/stopPropagation'
import './directives/rightClick'
import './directives/expandableTextArea'
import './directives/videoPlayState'
import './services/queued-http'
import './services/validateCaptcha'
import './services/validateCaptchaV3'
import './services/wait-for'
import './filters/formatDate'
import './main/event'
import './main/account-upgrade-angular'
import './main/system-messages'
import '../../modules/modules-ide.js'
import './features/source-editor/ide'
import './shared/context/controllers/root-context-controller'
import './features/editor-navigation-toolbar/controllers/editor-navigation-toolbar-controller'
import './features/pdf-preview/controllers/pdf-preview-controller'
import './features/share-project-modal/controllers/react-share-project-modal-controller'
import './features/source-editor/controllers/editor-switch-controller'
import './features/source-editor/controllers/cm6-switch-away-survey-controller'
import './features/source-editor/controllers/grammarly-warning-controller'
import './features/source-editor/controllers/legacy-editor-warning-controller'
import './features/outline/controllers/documentation-button-controller'
import './features/onboarding/controllers/onboarding-video-tour-modal-controller'
import './features/history/controllers/history-controller'
import './features/history/controllers/history-file-tree-controller'
import { cleanupServiceWorker } from './utils/service-worker-cleanup'
import { reportCM6Perf } from './infrastructure/cm6-performance'
import { reportAcePerf } from './ide/editor/ace-performance'
import { scheduleUserContentDomainAccessCheck } from './features/user-content-domain-access-check'

App.controller(
  'IdeController',
  function (
    $scope,
    $timeout,
    ide,
    localStorage,
    eventTracking,
    metadata,
    $q,
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

    const useFallbackWebsocket =
      window.location &&
      window.location.search &&
      window.location.search.match(/ws=fallback/)
    // if we previously failed to load the websocket fall back to null (the siteUrl)
    ide.wsUrl = useFallbackWebsocket ? null : window.sharelatex.wsUrl || null // websocket url (if defined)

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
    if (window.data.useV2History) {
      ide.historyManager = new HistoryV2Manager(ide, $scope, localStorage)
    } else {
      ide.historyManager = new HistoryManager(ide, $scope)
    }
    ide.permissionsManager = new PermissionsManager(ide, $scope)
    ide.binaryFilesManager = new BinaryFilesManager(ide, $scope)
    ide.metadataManager = new MetadataManager(ide, $scope, metadata)
    ide.outlineManager = new OutlineManager(ide, $scope)

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
        } else if (editorType === 'ace') {
          const acePerfData = reportAcePerf()

          if (acePerfData.numberOfEntries > 0) {
            const perfProps = [
              'NumberOfEntries',
              'MeanKeypressPaint',
              'Grammarly',
              'SessionLength',
              'Memory',
              'Lags',
              'NonLags',
              'LongestLag',
              'MeanLagsPerMeasure',
              'MeanKeypressesPerMeasure',
              'Release',
            ]

            for (const prop of perfProps) {
              const perfValue =
                acePerfData[prop.charAt(0).toLowerCase() + prop.slice(1)]
              if (perfValue !== null) {
                segmentation['acePerf' + prop] = perfValue
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
    $scope.$watch('settings.editorTheme', function (theme) {
      if (Array.from(DARK_THEMES).includes(theme)) {
        return ($scope.darkTheme = true)
      } else {
        return ($scope.darkTheme = false)
      }
    })

    ide.localStorage = localStorage

    ide.browserIsSafari = false

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

    try {
      ;({ userAgent } = navigator)
      ide.browserIsSafari =
        userAgent &&
        /.*Safari\/.*/.test(userAgent) &&
        !/.*Chrome\/.*/.test(userAgent) &&
        !/.*Chromium\/.*/.test(userAgent)
    } catch (error) {
      err = error
      console.error(err)
    }

    if (ide.browserIsSafari) {
      ide.safariScrollPatcher = new SafariScrollPatcher($scope)
    }

    // Fix Chrome 61 and 62 text-shadow rendering
    let browserIsChrome61or62 = false
    try {
      const chromeVersion =
        parseFloat(navigator.userAgent.split(' Chrome/')[1]) || null
      browserIsChrome61or62 = chromeVersion != null
      if (browserIsChrome61or62) {
        document.styleSheets[0].insertRule(
          '.ace_editor.ace_autocomplete .ace_completion-highlight { text-shadow: none !important; font-weight: bold; }',
          1
        )
      }
    } catch (error1) {
      err = error1
      console.error(err)
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
  }
)

cleanupServiceWorker()
scheduleUserContentDomainAccessCheck()

angular.module('SharelatexApp').config(function ($provide) {
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
})

export default angular.bootstrap(document.body, ['SharelatexApp'])

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
