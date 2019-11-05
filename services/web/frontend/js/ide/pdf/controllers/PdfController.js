define([
  'base',
  'ace/ace',
  'ide/human-readable-logs/HumanReadableLogs',
  'libs/bib-log-parser'
], function(App, Ace, HumanReadableLogs, BibLogParser) {
  const AUTO_COMPILE_MAX_WAIT = 5000
  // We add a 1 second debounce to sending user changes to server if they aren't
  // collaborating with anyone. This needs to be higher than that, and allow for
  // client to server latency, otherwise we compile before the op reaches the server
  // and then again on ack.
  const AUTO_COMPILE_DEBOUNCE = 2000

  App.filter('trusted', $sce => url => $sce.trustAsResourceUrl(url))

  App.controller('PdfController', function(
    $scope,
    $http,
    ide,
    $modal,
    synctex,
    eventTracking,
    localStorage
  ) {
    let autoCompile = true

    // pdf.view = uncompiled | pdf | errors
    $scope.pdf.view = $scope.pdf.url ? 'pdf' : 'uncompiled'
    $scope.shouldShowLogs = false
    $scope.wikiEnabled = window.wikiEnabled

    // view logic to check whether the files dropdown should "drop up" or "drop down"
    $scope.shouldDropUp = false

    const logsContainerEl = document.querySelector('.pdf-logs')
    const filesDropdownEl =
      logsContainerEl && logsContainerEl.querySelector('.files-dropdown')

    // get the top coordinate of the files dropdown as a ratio (to the logs container height)
    // logs container supports scrollable content, so it's possible that ratio > 1.
    function getFilesDropdownTopCoordAsRatio() {
      if (filesDropdownEl == null || logsContainerEl == null) {
        return 0
      }
      return (
        filesDropdownEl.getBoundingClientRect().top /
        logsContainerEl.getBoundingClientRect().height
      )
    }

    $scope.$watch('shouldShowLogs', shouldShow => {
      if (shouldShow) {
        $scope.$applyAsync(() => {
          $scope.shouldDropUp = getFilesDropdownTopCoordAsRatio() > 0.65
        })
      }
    })

    $scope.trackLogHintsLearnMore = function() {
      eventTracking.sendMB('logs-hints-learn-more')
    }

    if (ace.require('ace/lib/useragent').isMac) {
      $scope.modifierKey = 'Cmd'
    } else {
      $scope.modifierKey = 'Ctrl'
    }

    // utility for making a query string from a hash, could use jquery $.param
    function createQueryString(args) {
      const qsArgs = []
      for (const k in args) {
        const v = args[k]
        qsArgs.push(`${k}=${v}`)
      }
      if (qsArgs.length) {
        return `?${qsArgs.join('&')}`
      } else {
        return ''
      }
    }

    $scope.stripHTMLFromString = function(htmlStr) {
      const tmp = document.createElement('DIV')
      tmp.innerHTML = htmlStr
      return tmp.textContent || tmp.innerText || ''
    }

    $scope.$on('project:joined', () => {
      if (!autoCompile) {
        return
      }
      autoCompile = false
      $scope.recompile({ isAutoCompileOnLoad: true })
      $scope.hasPremiumCompile =
        $scope.project.features.compileGroup === 'priority'
    })

    $scope.$on('pdf:error:display', function() {
      $scope.pdf.view = 'errors'
      $scope.pdf.renderingError = true
    })

    let autoCompileInterval = null
    function autoCompileIfReady() {
      if (
        $scope.pdf.compiling ||
        !$scope.autocompile_enabled ||
        !$scope.pdf.uncompiled
      ) {
        return
      }

      // Only checking linting if syntaxValidation is on and visible to the user
      const autoCompileLintingError =
        ide.$scope.hasLintingError && ide.$scope.settings.syntaxValidation
      if ($scope.autoCompileLintingError !== autoCompileLintingError) {
        $scope.$apply(() => {
          $scope.autoCompileLintingError = autoCompileLintingError
          // We've likely been waiting a while until the user fixed the linting, but we
          // don't want to compile as soon as it is fixed, so reset the timeout.
          $scope.startedTryingAutoCompileAt = Date.now()
          $scope.docLastChangedAt = Date.now()
        })
      }
      if (autoCompileLintingError && $scope.stop_on_validation_error) {
        return
      }

      // If there's a longish compile, don't compile immediately after if user is still typing
      const startedTryingAt = Math.max(
        $scope.startedTryingAutoCompileAt,
        $scope.lastFinishedCompileAt || 0
      )

      const timeSinceStartedTrying = Date.now() - startedTryingAt
      const timeSinceLastChange = Date.now() - $scope.docLastChangedAt

      let shouldCompile = false
      if (timeSinceLastChange > AUTO_COMPILE_DEBOUNCE) {
        // Don't compile in the middle of the user typing
        shouldCompile = true
      } else if (timeSinceStartedTrying > AUTO_COMPILE_MAX_WAIT) {
        // Unless they type for a long time
        shouldCompile = true
      } else if (timeSinceStartedTrying < 0 || timeSinceLastChange < 0) {
        // If time is non-monotonic, assume that the user's system clock has been
        // changed and continue with compile
        shouldCompile = true
      }

      if (shouldCompile) {
        return triggerAutoCompile()
      }
    }

    function triggerAutoCompile() {
      $scope.recompile({ isAutoCompileOnChange: true })
    }

    function startTryingAutoCompile() {
      if (autoCompileInterval != null) {
        return
      }
      $scope.startedTryingAutoCompileAt = Date.now()
      autoCompileInterval = setInterval(autoCompileIfReady, 200)
    }

    function stopTryingAutoCompile() {
      clearInterval(autoCompileInterval)
      autoCompileInterval = null
    }

    $scope.changesToAutoCompile = false
    $scope.$watch('pdf.uncompiled', uncompiledChanges => {
      // don't autocompile if disabled or the pdf is not visible
      if (
        $scope.pdf.uncompiled &&
        $scope.autocompile_enabled &&
        !$scope.ui.pdfHidden
      ) {
        $scope.changesToAutoCompile = true
        startTryingAutoCompile()
      } else {
        $scope.changesToAutoCompile = false
        stopTryingAutoCompile()
      }
    })

    function recalculateUncompiledChanges() {
      if ($scope.docLastChangedAt == null) {
        $scope.pdf.uncompiled = false
      } else if (
        $scope.lastStartedCompileAt == null ||
        $scope.docLastChangedAt > $scope.lastStartedCompileAt
      ) {
        $scope.pdf.uncompiled = true
      } else {
        $scope.pdf.uncompiled = false
      }
    }

    function _updateDocLastChangedAt() {
      $scope.docLastChangedAt = Date.now()
      recalculateUncompiledChanges()
    }

    function onDocChanged() {
      $scope.autoCompileLintingError = false
      _updateDocLastChangedAt()
    }

    function onDocSaved() {
      // We use the save as a trigger too, to account for the delay between the client
      // and server. Otherwise, we might have compiled after the user made
      // the change on the client, but before the server had it.
      _updateDocLastChangedAt()
    }

    function onCompilingStateChanged(compiling) {
      recalculateUncompiledChanges()
    }

    ide.$scope.$on('doc:changed', onDocChanged)
    ide.$scope.$on('doc:saved', onDocSaved)
    $scope.$watch('pdf.compiling', onCompilingStateChanged)

    $scope.autocompile_enabled =
      localStorage(`autocompile_enabled:${$scope.project_id}`) || false
    $scope.$watch('autocompile_enabled', (newValue, oldValue) => {
      if (newValue != null && oldValue !== newValue) {
        if (newValue === true) {
          autoCompileIfReady()
        }
        localStorage(`autocompile_enabled:${$scope.project_id}`, newValue)
        eventTracking.sendMB('autocompile-setting-changed', {
          value: newValue
        })
      }
    })

    // abort compile if syntax checks fail
    $scope.stop_on_validation_error = localStorage(
      `stop_on_validation_error:${$scope.project_id}`
    )
    if ($scope.stop_on_validation_error == null) {
      $scope.stop_on_validation_error = true
    }
    // turn on for all users by default
    $scope.$watch('stop_on_validation_error', (newValue, oldValue) => {
      if (newValue != null && oldValue !== newValue) {
        localStorage(`stop_on_validation_error:${$scope.project_id}`, newValue)
      }
    })

    $scope.draft = localStorage(`draft:${$scope.project_id}`) || false
    $scope.$watch('draft', (newValue, oldValue) => {
      if (newValue != null && oldValue !== newValue) {
        localStorage(`draft:${$scope.project_id}`, newValue)
      }
    })

    function sendCompileRequest(options) {
      if (options == null) {
        options = {}
      }
      const url = `/project/${$scope.project_id}/compile`
      const params = {}
      if (options.isAutoCompileOnLoad || options.isAutoCompileOnChange) {
        params['auto_compile'] = true
      }
      // if the previous run was a check, clear the error logs
      if ($scope.check) {
        $scope.pdf.logEntries = []
      }
      // keep track of whether this is a compile or check
      $scope.check = !!options.check
      if (options.check) {
        eventTracking.sendMB('syntax-check-request')
      }
      // send appropriate check type to clsi
      let checkType
      if ($scope.check) {
        checkType = 'validate' // validate only
      } else if (options.try) {
        checkType = 'silent' // allow use to try compile once
      } else if ($scope.stop_on_validation_error) {
        checkType = 'error' // try to compile
      } else {
        checkType = 'silent' // ignore errors
      }

      // FIXME: Temporarily disable syntax checking as it is causing
      // excessive support requests for projects migrated from v1
      // https://github.com/overleaf/sharelatex/issues/911
      if (checkType === 'error') {
        checkType = 'silent'
      }

      return $http.post(
        url,
        {
          rootDoc_id: options.rootDocOverride_id || null,
          draft: $scope.draft,
          check: checkType,
          // use incremental compile for all users but revert to a full
          // compile if there is a server error
          incrementalCompilesEnabled: !$scope.pdf.error,
          _csrf: window.csrfToken
        },
        { params }
      )
    }

    function buildPdfDownloadUrl(pdfDownloadDomain, path) {
      // we only download builds from compiles server for security reasons
      if (
        pdfDownloadDomain != null &&
        path != null &&
        path.indexOf('build') !== -1
      ) {
        return `${pdfDownloadDomain}${path}`
      } else {
        return path
      }
    }

    function parseCompileResponse(response) {
      // keep last url
      const lastPdfUrl = $scope.pdf.url
      const { pdfDownloadDomain } = response
      // Reset everything
      $scope.pdf.error = false
      $scope.pdf.timedout = false
      $scope.pdf.failure = false
      $scope.pdf.url = null
      $scope.pdf.clsiMaintenance = false
      $scope.pdf.tooRecentlyCompiled = false
      $scope.pdf.renderingError = false
      $scope.pdf.projectTooLarge = false
      $scope.pdf.compileTerminated = false
      $scope.pdf.compileExited = false
      $scope.pdf.failedCheck = false
      $scope.pdf.compileInProgress = false
      $scope.pdf.autoCompileDisabled = false

      // make a cache to look up files by name
      const fileByPath = {}
      if (response.outputFiles != null) {
        for (const file of response.outputFiles) {
          fileByPath[file.path] = file
        }
      }

      // prepare query string
      let qs = {}
      // add a query string parameter for the compile group
      if (response.compileGroup != null) {
        ide.compileGroup = qs.compileGroup = response.compileGroup
      }
      // add a query string parameter for the clsi server id
      if (response.clsiServerId != null) {
        ide.clsiServerId = qs.clsiserverid = response.clsiServerId
      }

      if (response.status === 'timedout') {
        $scope.pdf.view = 'errors'
        $scope.pdf.timedout = true
        fetchLogs(fileByPath, { pdfDownloadDomain })
        if (
          !$scope.hasPremiumCompile &&
          ide.$scope.project.owner._id === ide.$scope.user.id
        ) {
          eventTracking.send(
            'subscription-funnel',
            'editor-click-feature',
            'compile-timeout'
          )
        }
      } else if (response.status === 'terminated') {
        $scope.pdf.view = 'errors'
        $scope.pdf.compileTerminated = true
        fetchLogs(fileByPath, { pdfDownloadDomain })
      } else if (
        ['validation-fail', 'validation-pass'].includes(response.status)
      ) {
        $scope.pdf.view = 'pdf'
        $scope.pdf.url = buildPdfDownloadUrl(pdfDownloadDomain, lastPdfUrl)
        $scope.shouldShowLogs = true
        if (response.status === 'validation-fail') {
          $scope.pdf.failedCheck = true
        }
        eventTracking.sendMB(`syntax-check-${response.status}`)
        fetchLogs(fileByPath, { validation: true, pdfDownloadDomain })
      } else if (response.status === 'exited') {
        $scope.pdf.view = 'pdf'
        $scope.pdf.compileExited = true
        $scope.pdf.url = buildPdfDownloadUrl(pdfDownloadDomain, lastPdfUrl)
        $scope.shouldShowLogs = true
        fetchLogs(fileByPath, { pdfDownloadDomain })
      } else if (response.status === 'autocompile-backoff') {
        if ($scope.pdf.isAutoCompileOnLoad) {
          // initial autocompile
          $scope.pdf.view = 'uncompiled'
        } else {
          // background autocompile from typing
          $scope.pdf.view = 'errors'
          $scope.pdf.autoCompileDisabled = true
          $scope.autocompile_enabled = false // disable any further autocompiles
          eventTracking.sendMB('autocompile-rate-limited', {
            hasPremiumCompile: $scope.hasPremiumCompile
          })
        }
      } else if (response.status === 'project-too-large') {
        $scope.pdf.view = 'errors'
        $scope.pdf.projectTooLarge = true
      } else if (response.status === 'failure') {
        $scope.pdf.view = 'errors'
        $scope.pdf.failure = true
        $scope.shouldShowLogs = true
        fetchLogs(fileByPath, { pdfDownloadDomain })
      } else if (response.status === 'clsi-maintenance') {
        $scope.pdf.view = 'errors'
        $scope.pdf.clsiMaintenance = true
      } else if (response.status === 'too-recently-compiled') {
        $scope.pdf.view = 'errors'
        $scope.pdf.tooRecentlyCompiled = true
      } else if (response.status === 'validation-problems') {
        $scope.pdf.view = 'validation-problems'
        $scope.pdf.validation = response.validationProblems
        $scope.shouldShowLogs = false
      } else if (response.status === 'compile-in-progress') {
        $scope.pdf.view = 'errors'
        $scope.pdf.compileInProgress = true
      } else if (response.status === 'success') {
        $scope.pdf.view = 'pdf'
        $scope.shouldShowLogs = false

        // define the base url. if the pdf file has a build number, pass it to the clsi in the url
        if (fileByPath['output.pdf'] && fileByPath['output.pdf'].url) {
          $scope.pdf.url = buildPdfDownloadUrl(
            pdfDownloadDomain,
            fileByPath['output.pdf'].url
          )
        } else if (fileByPath['output.pdf'] && fileByPath['output.pdf'].build) {
          const { build } = fileByPath['output.pdf']
          $scope.pdf.url = buildPdfDownloadUrl(
            pdfDownloadDomain,
            `/project/${$scope.project_id}/build/${build}/output/output.pdf`
          )
        } else {
          $scope.pdf.url = buildPdfDownloadUrl(
            pdfDownloadDomain,
            `/project/${$scope.project_id}/output/output.pdf`
          )
        }
        // check if we need to bust cache (build id is unique so don't need it in that case)
        if (fileByPath['output.pdf'] && fileByPath['output.pdf'].build) {
          qs.cache_bust = `${Date.now()}`
        }
        // convert the qs hash into a query string and append it
        $scope.pdf.url += createQueryString(qs)

        // Save all downloads as files
        qs.popupDownload = true

        // Pass build id to download if we have it
        let buildId = null
        if (fileByPath['output.pdf'] && fileByPath['output.pdf'].build) {
          buildId = fileByPath['output.pdf'].build
        }
        $scope.pdf.downloadUrl =
          `/download/project/${$scope.project_id}${
            buildId ? '/build/' + buildId : ''
          }/output/output.pdf` + createQueryString(qs)
        fetchLogs(fileByPath, { pdfDownloadDomain })
      }

      const IGNORE_FILES = ['output.fls', 'output.fdb_latexmk']
      $scope.pdf.outputFiles = []

      if (response.outputFiles == null) {
        return
      }

      // prepare list of output files for download dropdown
      qs = {}
      if (response.clsiServerId != null) {
        qs.clsiserverid = response.clsiServerId
      }
      for (const file of response.outputFiles) {
        if (IGNORE_FILES.indexOf(file.path) === -1) {
          const isOutputFile = /^output\./.test(file.path)
          $scope.pdf.outputFiles.push({
            // Turn 'output.blg' into 'blg file'.
            name: isOutputFile
              ? `${file.path.replace(/^output\./, '')} file`
              : file.path,
            url:
              `/project/${$scope.project_id}/output/${file.path}` +
              createQueryString(qs),
            main: !!isOutputFile
          })
        }
      }

      // sort the output files into order, main files first, then others
      $scope.pdf.outputFiles.sort(
        (a, b) => b.main - a.main || a.name.localeCompare(b.name)
      )
    }

    function fetchLogs(fileByPath, options) {
      let blgFile, chktexFile, logFile
      if (options != null ? options.validation : undefined) {
        chktexFile = fileByPath['output.chktex']
      } else {
        logFile = fileByPath['output.log']
        blgFile = fileByPath['output.blg']
      }

      function getFile(name, file) {
        const opts = {
          method: 'GET',
          params: {
            compileGroup: ide.compileGroup,
            clsiserverid: ide.clsiServerId
          }
        }
        if (file && file.url) {
          // FIXME clean this up when we have file.urls out consistently
          opts.url = file.url
        } else if (file && file.build) {
          opts.url = `/project/${$scope.project_id}/build/${
            file.build
          }/output/${name}`
        } else {
          opts.url = `/project/${$scope.project_id}/output/${name}`
        }
        // check if we need to bust cache (build id is unique so don't need it in that case)
        if (file && file.build) {
          opts.params.cache_bust = `${Date.now()}`
        }
        opts.url = buildPdfDownloadUrl(options.pdfDownloadDomain, opts.url)
        return $http(opts)
      }

      // accumulate the log entries
      const logEntries = {
        all: [],
        errors: [],
        warnings: []
      }

      function accumulateResults(newEntries) {
        for (let key of ['all', 'errors', 'warnings']) {
          if (newEntries.type != null) {
            for (let entry of newEntries[key]) {
              entry.type = newEntries.type
            }
          }
          logEntries[key] = logEntries[key].concat(newEntries[key])
        }
      }

      // use the parsers for each file type
      function processLog(log) {
        $scope.pdf.rawLog = log
        const { errors, warnings, typesetting } = HumanReadableLogs.parse(log, {
          ignoreDuplicates: true
        })
        const all = [].concat(errors, warnings, typesetting)
        accumulateResults({ all, errors, warnings })
      }

      function processChkTex(log) {
        const errors = []
        const warnings = []
        for (let line of log.split('\n')) {
          var m
          if ((m = line.match(/^(\S+):(\d+):(\d+): (Error|Warning): (.*)/))) {
            const result = {
              file: m[1],
              line: m[2],
              column: m[3],
              level: m[4].toLowerCase(),
              message: `${m[4]}: ${m[5]}`
            }
            if (result.level === 'error') {
              errors.push(result)
            } else {
              warnings.push(result)
            }
          }
        }
        const all = [].concat(errors, warnings)
        const logHints = HumanReadableLogs.parse({
          type: 'Syntax',
          all,
          errors,
          warnings
        })
        eventTracking.sendMB('syntax-check-return-count', {
          errors: errors.length,
          warnings: warnings.length
        })
        accumulateResults(logHints)
      }

      function processBiber(log) {
        const { errors, warnings } = BibLogParser.parse(log, {})
        const all = [].concat(errors, warnings)
        accumulateResults({ type: 'BibTeX', all, errors, warnings })
      }

      // output the results
      function handleError() {
        $scope.pdf.logEntries = []
        $scope.pdf.rawLog = ''
      }

      function annotateFiles() {
        $scope.pdf.logEntries = logEntries
        $scope.pdf.logEntryAnnotations = {}
        for (const entry of logEntries.all) {
          if (entry.file != null) {
            entry.file = normalizeFilePath(entry.file)
            const entity = ide.fileTreeManager.findEntityByPath(entry.file)
            if (entity != null) {
              if (!$scope.pdf.logEntryAnnotations[entity.id]) {
                $scope.pdf.logEntryAnnotations[entity.id] = []
              }
              $scope.pdf.logEntryAnnotations[entity.id].push({
                row: entry.line - 1,
                type: entry.level === 'error' ? 'error' : 'warning',
                text: entry.message
              })
            }
          }
        }
      }

      // retrieve the logfile and process it
      let response
      if (logFile != null) {
        response = getFile('output.log', logFile).then(response =>
          processLog(response.data)
        )

        if (blgFile != null) {
          // retrieve the blg file if present
          response = response.then(() =>
            getFile('output.blg', blgFile).then(
              response => processBiber(response.data),
              () => true
            )
          )
        }
      }

      if (response != null) {
        response.catch(handleError)
      } else {
        handleError()
      }

      if (chktexFile != null) {
        const getChkTex = () =>
          getFile('output.chktex', chktexFile).then(response =>
            processChkTex(response.data)
          )
        // always retrieve the chktex file if present
        if (response != null) {
          response = response.then(getChkTex, getChkTex)
        } else {
          response = getChkTex()
        }
      }

      // display the combined result
      if (response != null) {
        response.finally(annotateFiles)
      }
    }

    function getRootDocOverrideId() {
      const doc = ide.editorManager.getCurrentDocValue()
      if (doc == null) {
        return null
      }
      for (let line of doc.split('\n')) {
        if (/^[^%]*\\documentclass/.test(line)) {
          return ide.editorManager.getCurrentDocId()
        }
      }
      return null
    }

    function normalizeFilePath(path) {
      path = path.replace(
        /^(.*)\/compiles\/[0-9a-f]{24}(-[0-9a-f]{24})?\/(\.\/)?/,
        ''
      )
      path = path.replace(/^\/compile\//, '')

      const rootDocDirname = ide.fileTreeManager.getRootDocDirname()
      if (rootDocDirname != null) {
        path = path.replace(/^\.\//, rootDocDirname + '/')
      }

      return path
    }

    $scope.recompile = function(options) {
      if (options == null) {
        options = {}
      }
      if ($scope.pdf.compiling) {
        return
      }

      eventTracking.sendMBSampled('editor-recompile-sampled', options)

      $scope.lastStartedCompileAt = Date.now()
      $scope.pdf.compiling = true
      $scope.pdf.isAutoCompileOnLoad =
        options != null ? options.isAutoCompileOnLoad : undefined // initial autocompile

      if (options != null ? options.force : undefined) {
        // for forced compile, turn off validation check and ignore errors
        $scope.stop_on_validation_error = false
        $scope.shouldShowLogs = false // hide the logs while compiling
        eventTracking.sendMB('syntax-check-turn-off-checking')
      }

      if (options != null ? options.try : undefined) {
        $scope.shouldShowLogs = false // hide the logs while compiling
        eventTracking.sendMB('syntax-check-try-compile-anyway')
      }

      ide.$scope.$broadcast('flush-changes')

      options.rootDocOverride_id = getRootDocOverrideId()

      sendCompileRequest(options)
        .then(function(response) {
          const { data } = response
          $scope.pdf.view = 'pdf'
          $scope.pdf.compiling = false
          parseCompileResponse(data)
        })
        .catch(function(response) {
          const { status } = response
          if (status === 429) {
            $scope.pdf.rateLimited = true
          }
          $scope.pdf.compiling = false
          $scope.pdf.renderingError = false
          $scope.pdf.error = true
          $scope.pdf.view = 'errors'
        })
        .finally(() => {
          $scope.lastFinishedCompileAt = Date.now()
        })
    }

    // This needs to be public.
    ide.$scope.recompile = $scope.recompile
    // This method is a simply wrapper and exists only for tracking purposes.
    ide.$scope.recompileViaKey = function() {
      $scope.recompile({ keyShortcut: true })
    }

    $scope.stop = function() {
      if (!$scope.pdf.compiling) {
        return
      }

      return $http({
        url: `/project/${$scope.project_id}/compile/stop`,
        method: 'POST',
        params: {
          clsiserverid: ide.clsiServerId
        },
        headers: {
          'X-Csrf-Token': window.csrfToken
        }
      })
    }

    $scope.clearCache = function() {
      return $http({
        url: `/project/${$scope.project_id}/output`,
        method: 'DELETE',
        params: {
          clsiserverid: ide.clsiServerId
        },
        headers: {
          'X-Csrf-Token': window.csrfToken
        }
      })
    }

    $scope.toggleLogs = function() {
      $scope.shouldShowLogs = !$scope.shouldShowLogs
      if ($scope.shouldShowLogs) {
        eventTracking.sendMBOnce('ide-open-logs-once')
      }
    }

    $scope.showPdf = function() {
      $scope.pdf.view = 'pdf'
      $scope.shouldShowLogs = false
    }

    $scope.toggleRawLog = function() {
      $scope.pdf.showRawLog = !$scope.pdf.showRawLog
      if ($scope.pdf.showRawLog) {
        eventTracking.sendMB('logs-view-raw')
      }
    }

    $scope.openClearCacheModal = function() {
      $modal.open({
        templateUrl: 'clearCacheModalTemplate',
        controller: 'ClearCacheModalController',
        scope: $scope
      })
    }

    $scope.syncToCode = function(position) {
      synctex.syncToCode(position).then(function(data) {
        const { doc, line } = data
        ide.editorManager.openDoc(doc, { gotoLine: line })
      })
    }
  })

  App.factory('synctex', function(ide, $http, $q) {
    const synctex = {
      syncToPdf(cursorPosition) {
        const deferred = $q.defer()

        const docId = ide.editorManager.getCurrentDocId()
        if (docId == null) {
          deferred.reject()
          return deferred.promise
        }
        const doc = ide.fileTreeManager.findEntityById(docId)
        if (doc == null) {
          deferred.reject()
          return deferred.promise
        }
        let path = ide.fileTreeManager.getEntityPath(doc)
        if (path == null) {
          deferred.reject()
          return deferred.promise
        }

        // If the root file is folder/main.tex, then synctex sees the
        // path as folder/./main.tex
        const rootDocDirname = ide.fileTreeManager.getRootDocDirname()
        if (rootDocDirname != null && rootDocDirname !== '') {
          path = path.replace(
            RegExp(`^${rootDocDirname}`),
            `${rootDocDirname}/.`
          )
        }

        const { row, column } = cursorPosition

        $http({
          url: `/project/${ide.project_id}/sync/code`,
          method: 'GET',
          params: {
            file: path,
            line: row + 1,
            column,
            clsiserverid: ide.clsiServerId
          }
        })
          .then(function(response) {
            const { data } = response
            return deferred.resolve(data.pdf || [])
          })
          .catch(function(response) {
            const error = response.data
            return deferred.reject(error)
          })

        return deferred.promise
      },

      syncToCode(position, options) {
        if (options == null) {
          options = {}
        }
        const deferred = $q.defer()
        if (position == null) {
          deferred.reject()
          return deferred.promise
        }

        // FIXME: this actually works better if it's halfway across the
        // page (or the visible part of the page). Synctex doesn't
        // always find the right place in the file when the point is at
        // the edge of the page, it sometimes returns the start of the
        // next paragraph instead.
        const h = position.offset.left

        // Compute the vertical position to pass to synctex, which
        // works with coordinates increasing from the top of the page
        // down.  This matches the browser's DOM coordinate of the
        // click point, but the pdf position is measured from the
        // bottom of the page so we need to invert it.
        let v
        if (
          options.fromPdfPosition &&
          (position.pageSize != null ? position.pageSize.height : undefined) !=
            null
        ) {
          v = position.pageSize.height - position.offset.top || 0 // measure from pdf point (inverted)
        } else {
          v = position.offset.top || 0 // measure from html click position
        }

        // It's not clear exactly where we should sync to if it wasn't directly
        // clicked on, but a little bit down from the very top seems best.
        if (options.includeVisualOffset) {
          v += 72 // use the same value as in pdfViewer highlighting visual offset
        }

        $http({
          url: `/project/${ide.project_id}/sync/pdf`,
          method: 'GET',
          params: {
            page: position.page + 1,
            h: h.toFixed(2),
            v: v.toFixed(2),
            clsiserverid: ide.clsiServerId
          }
        })
          .then(function(response) {
            const { data } = response
            if (
              data.code != null &&
              data.code.length > 0 &&
              data.code[0].file !== ''
            ) {
              const doc = ide.fileTreeManager.findEntityByPath(
                data.code[0].file
              )
              if (doc == null) {
                return
              }
              return deferred.resolve({ doc, line: data.code[0].line })
            } else if (data.code[0].file === '') {
              ide.$scope.sync_tex_error = true
              setTimeout(() => (ide.$scope.sync_tex_error = false), 4000)
            }
          })
          .catch(function(response) {
            const error = response.data
            return deferred.reject(error)
          })

        return deferred.promise
      }
    }

    return synctex
  })

  App.controller('PdfSynctexController', function($scope, synctex, ide) {
    this.cursorPosition = null
    ide.$scope.$on('cursor:editor:update', (event, cursorPosition) => {
      this.cursorPosition = cursorPosition
    })

    $scope.syncToPdf = () => {
      if (this.cursorPosition == null) {
        return
      }
      synctex.syncToPdf(this.cursorPosition).then(highlights => {
        $scope.pdf.highlights = highlights
      })
    }

    ide.$scope.$on('cursor:editor:syncToPdf', $scope.syncToPdf)

    $scope.syncToCode = function() {
      synctex
        .syncToCode($scope.pdf.position, {
          includeVisualOffset: true,
          fromPdfPosition: true
        })
        .then(function(data) {
          const { doc, line } = data
          ide.editorManager.openDoc(doc, { gotoLine: line })
        })
    }
  })

  App.controller('PdfLogEntryController', function($scope, ide, eventTracking) {
    $scope.openInEditor = function(entry) {
      let column, line
      eventTracking.sendMBOnce('logs-jump-to-location-once')
      const entity = ide.fileTreeManager.findEntityByPath(entry.file)
      if (entity == null || entity.type !== 'doc') {
        return
      }
      if (entry.line != null) {
        line = entry.line
      }
      if (entry.column != null) {
        column = entry.column
      }
      ide.editorManager.openDoc(entity, {
        gotoLine: line,
        gotoColumn: column
      })
    }
  })

  App.controller('ClearCacheModalController', function($scope, $modalInstance) {
    $scope.state = { inflight: false }

    $scope.clear = function() {
      $scope.state.inflight = true
      $scope.clearCache().then(function() {
        $scope.state.inflight = false
        $modalInstance.close()
      })
    }

    $scope.cancel = () => $modalInstance.dismiss('cancel')
  })
})
