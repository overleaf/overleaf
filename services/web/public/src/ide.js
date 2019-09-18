/* eslint-disable
    camelcase,
    max-len,
    no-cond-assign,
    no-return-assign,
    no-undef,
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
define([
  'base',
  'ide/file-tree/FileTreeManager',
  'ide/connection/ConnectionManager',
  'ide/editor/EditorManager',
  'ide/online-users/OnlineUsersManager',
  'ide/history/HistoryManager',
  'ide/history/HistoryV2Manager',
  'ide/permissions/PermissionsManager',
  'ide/pdf/PdfManager',
  'ide/binary-files/BinaryFilesManager',
  'ide/references/ReferencesManager',
  'ide/metadata/MetadataManager',
  'ide/review-panel/ReviewPanelManager',
  'ide/SafariScrollPatcher',
  'ide/cobranding/CobrandingDataService',
  'ide/settings/index',
  'ide/share/index',
  'ide/chat/index',
  'ide/clone/index',
  'ide/hotkeys/index',
  'ide/test-controls/index',
  'ide/wordcount/index',
  'ide/directives/layout',
  'ide/directives/validFile',
  'ide/services/ide',
  '__IDE_CLIENTSIDE_INCLUDES__',
  'analytics/AbTestingManager',
  'directives/focus',
  'directives/fineUpload',
  'directives/scroll',
  'directives/onEnter',
  'directives/stopPropagation',
  'directives/rightClick',
  'directives/expandableTextArea',
  'directives/videoPlayState',
  'services/queued-http',
  'services/validateCaptcha',
  'services/validateCaptchaV3',
  'services/wait-for',
  'filters/formatDate',
  'main/event',
  'main/account-upgrade'
], function(
  App,
  FileTreeManager,
  ConnectionManager,
  EditorManager,
  OnlineUsersManager,
  HistoryManager,
  HistoryV2Manager,
  PermissionsManager,
  PdfManager,
  BinaryFilesManager,
  ReferencesManager,
  MetadataManager,
  ReviewPanelManager,
  SafariScrollPatcher
) {
  App.controller('IdeController', function(
    $scope,
    $timeout,
    ide,
    localStorage,
    event_tracking,
    metadata,
    $q,
    CobrandingDataService
  ) {
    // Don't freak out if we're already in an apply callback
    let err, pdfLayout, userAgent
    $scope.$originalApply = $scope.$apply
    $scope.$apply = function(fn) {
      if (fn == null) {
        fn = function() {}
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
      error: null
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
      chatResizerSizeOpen: window.uiConfig.chatResizerSizeOpen,
      chatResizerSizeClosed: window.uiConfig.chatResizerSizeClosed,
      defaultFontFamily: window.uiConfig.defaultFontFamily,
      defaultLineHeight: window.uiConfig.defaultLineHeight
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
      brandVariationHomeUrl: CobrandingDataService.getBrandVariationHomeUrl()
    }

    $scope.chat = {}

    ide.toggleReviewPanel = $scope.toggleReviewPanel = function() {
      if (!$scope.project.features.trackChangesVisible) {
        return
      }
      $scope.ui.reviewPanelOpen = !$scope.ui.reviewPanelOpen
      return event_tracking.sendMB('rp-toggle-panel', {
        value: $scope.ui.reviewPanelOpen
      })
    }

    $scope.$watch('ui.reviewPanelOpen', function(value) {
      if (value != null) {
        return localStorage(`ui.reviewPanelOpen.${window.project_id}`, value)
      }
    })

    $scope.$on('layout:pdf:resize', function(_, layoutState) {
      $scope.ui.pdfHidden = layoutState.east.initClosed
      return ($scope.ui.pdfWidth = layoutState.east.size)
    })

    $scope.$watch('ui.view', function(newView, oldView) {
      if (newView !== oldView) {
        $scope.$broadcast('layout:flat-screen:toggle')
      }
      if (newView != null && newView !== 'editor' && newView !== 'pdf') {
        return event_tracking.sendMBOnce(`ide-open-view-${newView}-once`)
      }
    })

    $scope.$watch('ui.chatOpen', function(isOpen) {
      if (isOpen) {
        return event_tracking.sendMBOnce('ide-open-chat-once')
      }
    })

    $scope.$watch('ui.leftMenuShown', function(isOpen) {
      if (isOpen) {
        return event_tracking.sendMBOnce('ide-open-left-menu-once')
      }
    })

    $scope.trackHover = feature =>
      event_tracking.sendMBOnce(`ide-hover-${feature}-once`)
    // End of tracking code.

    window._ide = ide

    ide.validFileRegex = '^[^*/]*$' // Don't allow * and /

    let useFallbackWebsocket =
      window.location &&
      window.location.search &&
      window.location.search.match(/ws=fallback/)
    // if we previously failed to load the websocket fall back to null (the siteUrl)
    ide.wsUrl = useFallbackWebsocket ? null : window.sharelatex.wsUrl || null // websocket url (if defined)

    ide.project_id = $scope.project_id = window.project_id
    ide.$scope = $scope

    ide.referencesSearchManager = new ReferencesManager(ide, $scope)
    ide.connectionManager = new ConnectionManager(ide, $scope)
    ide.fileTreeManager = new FileTreeManager(ide, $scope)
    ide.editorManager = new EditorManager(ide, $scope, localStorage)
    ide.onlineUsersManager = new OnlineUsersManager(ide, $scope)
    if (window.data.useV2History) {
      ide.historyManager = new HistoryV2Manager(ide, $scope, localStorage)
    } else {
      ide.historyManager = new HistoryManager(ide, $scope)
    }
    ide.pdfManager = new PdfManager(ide, $scope)
    ide.permissionsManager = new PermissionsManager(ide, $scope)
    ide.binaryFilesManager = new BinaryFilesManager(ide, $scope)
    ide.metadataManager = new MetadataManager(ide, $scope, metadata)

    let inited = false
    $scope.$on('project:joined', function() {
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
We don't want to delete your data on ShareLaTeX, so this project still contains your history and collaborators.
If the project has been renamed please look in your project list for a new project under the new name.\
`
        )
      }
      return $timeout(function() {
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
    $scope.$on('doc:opened', function() {
      if (_loaded) {
        return
      }
      $scope.$broadcast('ide:loaded')
      return (_loaded = true)
    })

    $scope.$on('cursor:editor:update', event_tracking.editingSessionHeartbeat)

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
      'vibrant_ink'
    ]
    $scope.darkTheme = false
    $scope.$watch('settings.editorTheme', function(theme) {
      if (Array.from(DARK_THEMES).includes(theme)) {
        return ($scope.darkTheme = true)
      } else {
        return ($scope.darkTheme = false)
      }
    })

    ide.localStorage = localStorage

    ide.browserIsSafari = false

    $scope.switchToFlatLayout = function(view) {
      $scope.ui.pdfLayout = 'flat'
      $scope.ui.view = view
      return ide.localStorage('pdf.layout', 'flat')
    }

    $scope.switchToSideBySideLayout = function(view) {
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

    return ide.socket.on('project:publicAccessLevel:changed', data => {
      if (data.newAccessLevel != null) {
        ide.$scope.project.publicAccesLevel = data.newAccessLevel
        return $scope.$digest()
      }
    })
  })

  return angular.bootstrap(document.body, ['SharelatexApp'])
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
