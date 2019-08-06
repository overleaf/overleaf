/* eslint-disable
    camelcase,
    max-len,
    no-cond-assign,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
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
    event_tracking,
    localStorage
  ) {
    // enable per-user containers by default
    const perUserCompile = true
    let autoCompile = true

    // pdf.view = uncompiled | pdf | errors
    $scope.pdf.view = __guard__(
      $scope != null ? $scope.pdf : undefined,
      x => x.url
    )
      ? 'pdf'
      : 'uncompiled'
    $scope.shouldShowLogs = false
    $scope.wikiEnabled = window.wikiEnabled

    // view logic to check whether the files dropdown should "drop up" or "drop down"
    $scope.shouldDropUp = false

    const logsContainerEl = document.querySelector('.pdf-logs')
    const filesDropdownEl =
      logsContainerEl != null
        ? logsContainerEl.querySelector('.files-dropdown')
        : undefined

    // get the top coordinate of the files dropdown as a ratio (to the logs container height)
    // logs container supports scrollable content, so it's possible that ratio > 1.
    const getFilesDropdownTopCoordAsRatio = () =>
      (filesDropdownEl != null
        ? filesDropdownEl.getBoundingClientRect().top
        : undefined) /
      (logsContainerEl != null
        ? logsContainerEl.getBoundingClientRect().height
        : undefined)

    $scope.$watch('shouldShowLogs', function(shouldShow) {
      if (shouldShow) {
        return $scope.$applyAsync(
          () => ($scope.shouldDropUp = getFilesDropdownTopCoordAsRatio() > 0.65)
        )
      }
    })

    $scope.trackLogHintsLearnMore = () =>
      event_tracking.sendMB('logs-hints-learn-more')

    if (ace.require('ace/lib/useragent').isMac) {
      $scope.modifierKey = 'Cmd'
    } else {
      $scope.modifierKey = 'Ctrl'
    }

    // utility for making a query string from a hash, could use jquery $.param
    const createQueryString = function(args) {
      const qs_args = (() => {
        const result = []
        for (let k in args) {
          const v = args[k]
          result.push(`${k}=${v}`)
        }
        return result
      })()
      if (qs_args.length) {
        return `?${qs_args.join('&')}`
      } else {
        return ''
      }
    }

    $scope.stripHTMLFromString = function(htmlStr) {
      const tmp = document.createElement('DIV')
      tmp.innerHTML = htmlStr
      return tmp.textContent || tmp.innerText || ''
    }

    $scope.$on('project:joined', function() {
      if (!autoCompile) {
        return
      }
      autoCompile = false
      $scope.recompile({ isAutoCompileOnLoad: true })
      return ($scope.hasPremiumCompile =
        $scope.project.features.compileGroup === 'priority')
    })

    $scope.$on('pdf:error:display', function() {
      $scope.pdf.view = 'errors'
      return ($scope.pdf.renderingError = true)
    })

    let autoCompileInterval = null
    const autoCompileIfReady = function() {
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
        $scope.$apply(function() {
          $scope.autoCompileLintingError = autoCompileLintingError
          // We've likely been waiting a while until the user fixed the linting, but we
          // don't want to compile as soon as it is fixed, so reset the timeout.
          $scope.startedTryingAutoCompileAt = Date.now()
          return ($scope.docLastChangedAt = Date.now())
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

    var triggerAutoCompile = () =>
      $scope.recompile({ isAutoCompileOnChange: true })

    const startTryingAutoCompile = function() {
      if (autoCompileInterval != null) {
        return
      }
      $scope.startedTryingAutoCompileAt = Date.now()
      return (autoCompileInterval = setInterval(autoCompileIfReady, 200))
    }

    const stopTryingAutoCompile = function() {
      clearInterval(autoCompileInterval)
      return (autoCompileInterval = null)
    }

    $scope.changesToAutoCompile = false
    $scope.$watch('pdf.uncompiled', function(uncompiledChanges) {
      // don't autocompile if disabled or the pdf is not visible
      if (
        $scope.pdf.uncompiled &&
        $scope.autocompile_enabled &&
        !$scope.ui.pdfHidden
      ) {
        $scope.changesToAutoCompile = true
        return startTryingAutoCompile()
      } else {
        $scope.changesToAutoCompile = false
        return stopTryingAutoCompile()
      }
    })

    const recalculateUncompiledChanges = function() {
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

    const _updateDocLastChangedAt = function() {
      $scope.docLastChangedAt = Date.now()
      return recalculateUncompiledChanges()
    }

    const onDocChanged = function() {
      $scope.autoCompileLintingError = false
      return _updateDocLastChangedAt()
    }

    const onDocSaved = () =>
      // We use the save as a trigger too, to account for the delay between the client
      // and server. Otherwise, we might have compiled after the user made
      // the change on the client, but before the server had it.
      _updateDocLastChangedAt()

    const onCompilingStateChanged = compiling => recalculateUncompiledChanges()

    ide.$scope.$on('doc:changed', onDocChanged)
    ide.$scope.$on('doc:saved', onDocSaved)
    $scope.$watch('pdf.compiling', onCompilingStateChanged)

    $scope.autocompile_enabled =
      localStorage(`autocompile_enabled:${$scope.project_id}`) || false
    $scope.$watch('autocompile_enabled', function(newValue, oldValue) {
      if (newValue != null && oldValue !== newValue) {
        if (newValue === true) {
          autoCompileIfReady()
        }
        localStorage(`autocompile_enabled:${$scope.project_id}`, newValue)
        return event_tracking.sendMB('autocompile-setting-changed', {
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
    } // turn on for all users by default
    $scope.$watch('stop_on_validation_error', function(new_value, old_value) {
      if (new_value != null && old_value !== new_value) {
        return localStorage(
          `stop_on_validation_error:${$scope.project_id}`,
          new_value
        )
      }
    })

    $scope.draft = localStorage(`draft:${$scope.project_id}`) || false
    $scope.$watch('draft', function(new_value, old_value) {
      if (new_value != null && old_value !== new_value) {
        return localStorage(`draft:${$scope.project_id}`, new_value)
      }
    })

    const sendCompileRequest = function(options) {
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
        event_tracking.sendMB('syntax-check-request')
      }
      // send appropriate check type to clsi
      let checkType = (() => {
        switch (false) {
          case !$scope.check:
            return 'validate' // validate only
          case !options.try:
            return 'silent' // allow use to try compile once
          case !$scope.stop_on_validation_error:
            return 'error' // try to compile
          default:
            return 'silent' // ignore errors
        }
      })()
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

    const buildPdfDownloadUrl = function(pdfDownloadDomain, path) {
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

    const parseCompileResponse = function(response) {
      // keep last url
      let file
      const last_pdf_url = $scope.pdf.url
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
      if ((response != null ? response.outputFiles : undefined) != null) {
        for (file of Array.from(
          response != null ? response.outputFiles : undefined
        )) {
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
          event_tracking.send(
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
        $scope.pdf.url = buildPdfDownloadUrl(pdfDownloadDomain, last_pdf_url)
        $scope.shouldShowLogs = true
        if (response.status === 'validation-fail') {
          $scope.pdf.failedCheck = true
        }
        event_tracking.sendMB(`syntax-check-${response.status}`)
        fetchLogs(fileByPath, { validation: true, pdfDownloadDomain })
      } else if (response.status === 'exited') {
        $scope.pdf.view = 'pdf'
        $scope.pdf.compileExited = true
        $scope.pdf.url = buildPdfDownloadUrl(pdfDownloadDomain, last_pdf_url)
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
          event_tracking.sendMB('autocompile-rate-limited', {
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
        let build
        $scope.pdf.view = 'pdf'
        $scope.shouldShowLogs = false

        // define the base url. if the pdf file has a build number, pass it to the clsi in the url
        if (
          (fileByPath['output.pdf'] != null
            ? fileByPath['output.pdf'].url
            : undefined) != null
        ) {
          $scope.pdf.url = buildPdfDownloadUrl(
            pdfDownloadDomain,
            fileByPath['output.pdf'].url
          )
        } else if (
          (fileByPath['output.pdf'] != null
            ? fileByPath['output.pdf'].build
            : undefined) != null
        ) {
          ;({ build } = fileByPath['output.pdf'])
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
        if (
          (fileByPath['output.pdf'] != null
            ? fileByPath['output.pdf'].build
            : undefined) == null
        ) {
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
      for (file of Array.from(response.outputFiles)) {
        if (IGNORE_FILES.indexOf(file.path) === -1) {
          const isOutputFile = /^output\./.test(file.path)
          $scope.pdf.outputFiles.push({
            // Turn 'output.blg' into 'blg file'.
            name: isOutputFile
              ? `${file.path.replace(/^output\./, '')} file`
              : file.path,
            url:
              `/project/${project_id}/output/${file.path}` +
              createQueryString(qs),
            main: !!isOutputFile
          })
        }
      }

      // sort the output files into order, main files first, then others
      return $scope.pdf.outputFiles.sort(
        (a, b) => b.main - a.main || a.name.localeCompare(b.name)
      )
    }

    var fetchLogs = function(fileByPath, options) {
      let blgFile, chktexFile, logFile, response
      if (options != null ? options.validation : undefined) {
        chktexFile = fileByPath['output.chktex']
      } else {
        logFile = fileByPath['output.log']
        blgFile = fileByPath['output.blg']
      }

      const getFile = function(name, file) {
        const opts = {
          method: 'GET',
          params: {
            compileGroup: ide.compileGroup,
            clsiserverid: ide.clsiServerId
          }
        }
        if ((file != null ? file.url : undefined) != null) {
          // FIXME clean this up when we have file.urls out consistently
          opts.url = file.url
        } else if ((file != null ? file.build : undefined) != null) {
          opts.url = `/project/${$scope.project_id}/build/${
            file.build
          }/output/${name}`
        } else {
          opts.url = `/project/${$scope.project_id}/output/${name}`
        }
        // check if we need to bust cache (build id is unique so don't need it in that case)
        if ((file != null ? file.build : undefined) == null) {
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

      const accumulateResults = newEntries =>
        (() => {
          const result = []
          for (let key of ['all', 'errors', 'warnings']) {
            if (newEntries.type != null) {
              for (let entry of Array.from(newEntries[key])) {
                entry.type = newEntries.type
              }
            }
            result.push(
              (logEntries[key] = logEntries[key].concat(newEntries[key]))
            )
          }
          return result
        })()

      // use the parsers for each file type
      const processLog = function(log) {
        $scope.pdf.rawLog = log
        const { errors, warnings, typesetting } = HumanReadableLogs.parse(log, {
          ignoreDuplicates: true
        })
        const all = [].concat(errors, warnings, typesetting)
        return accumulateResults({ all, errors, warnings })
      }

      const processChkTex = function(log) {
        const errors = []
        const warnings = []
        for (let line of Array.from(log.split('\n'))) {
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
        event_tracking.sendMB('syntax-check-return-count', {
          errors: errors.length,
          warnings: warnings.length
        })
        return accumulateResults(logHints)
      }

      const processBiber = function(log) {
        const { errors, warnings } = BibLogParser.parse(log, {})
        const all = [].concat(errors, warnings)
        return accumulateResults({ type: 'BibTeX', all, errors, warnings })
      }

      // output the results
      const handleError = function() {
        $scope.pdf.logEntries = []
        return ($scope.pdf.rawLog = '')
      }

      const annotateFiles = function() {
        $scope.pdf.logEntries = logEntries
        $scope.pdf.logEntryAnnotations = {}
        return (() => {
          const result = []
          for (let entry of Array.from(logEntries.all)) {
            if (entry.file != null) {
              entry.file = normalizeFilePath(entry.file)
              const entity = ide.fileTreeManager.findEntityByPath(entry.file)
              if (entity != null) {
                if (!$scope.pdf.logEntryAnnotations[entity.id]) {
                  $scope.pdf.logEntryAnnotations[entity.id] = []
                }
                result.push(
                  $scope.pdf.logEntryAnnotations[entity.id].push({
                    row: entry.line - 1,
                    type: entry.level === 'error' ? 'error' : 'warning',
                    text: entry.message
                  })
                )
              } else {
                result.push(undefined)
              }
            } else {
              result.push(undefined)
            }
          }
          return result
        })()
      }

      // retrieve the logfile and process it
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
        return response.finally(annotateFiles)
      }
    }

    const getRootDocOverride_id = function() {
      const doc = ide.editorManager.getCurrentDocValue()
      if (doc == null) {
        return null
      }
      for (let line of Array.from(doc.split('\n'))) {
        if (/^[^%]*\\documentclass/.test(line)) {
          return ide.editorManager.getCurrentDocId()
        }
      }
      return null
    }

    var normalizeFilePath = function(path) {
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

      event_tracking.sendMBSampled('editor-recompile-sampled', options)

      $scope.lastStartedCompileAt = Date.now()
      $scope.pdf.compiling = true
      $scope.pdf.isAutoCompileOnLoad =
        options != null ? options.isAutoCompileOnLoad : undefined // initial autocompile

      if (options != null ? options.force : undefined) {
        // for forced compile, turn off validation check and ignore errors
        $scope.stop_on_validation_error = false
        $scope.shouldShowLogs = false // hide the logs while compiling
        event_tracking.sendMB('syntax-check-turn-off-checking')
      }

      if (options != null ? options.try : undefined) {
        $scope.shouldShowLogs = false // hide the logs while compiling
        event_tracking.sendMB('syntax-check-try-compile-anyway')
      }

      ide.$scope.$broadcast('flush-changes')

      options.rootDocOverride_id = getRootDocOverride_id()

      return sendCompileRequest(options)
        .then(function(response) {
          const { data } = response
          $scope.pdf.view = 'pdf'
          $scope.pdf.compiling = false
          return parseCompileResponse(data)
        })
        .catch(function(response) {
          const { data, status } = response
          if (status === 429) {
            $scope.pdf.rateLimited = true
          }
          $scope.pdf.compiling = false
          $scope.pdf.renderingError = false
          $scope.pdf.error = true
          return ($scope.pdf.view = 'errors')
        })
        .finally(() => ($scope.lastFinishedCompileAt = Date.now()))
    }

    // This needs to be public.
    ide.$scope.recompile = $scope.recompile
    // This method is a simply wrapper and exists only for tracking purposes.
    ide.$scope.recompileViaKey = () => $scope.recompile({ keyShortcut: true })

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

    $scope.clearCache = () =>
      $http({
        url: `/project/${$scope.project_id}/output`,
        method: 'DELETE',
        params: {
          clsiserverid: ide.clsiServerId
        },
        headers: {
          'X-Csrf-Token': window.csrfToken
        }
      })

    $scope.toggleLogs = function() {
      $scope.shouldShowLogs = !$scope.shouldShowLogs
      if ($scope.shouldShowLogs) {
        return event_tracking.sendMBOnce('ide-open-logs-once')
      }
    }

    $scope.showPdf = function() {
      $scope.pdf.view = 'pdf'
      return ($scope.shouldShowLogs = false)
    }

    $scope.toggleRawLog = function() {
      $scope.pdf.showRawLog = !$scope.pdf.showRawLog
      if ($scope.pdf.showRawLog) {
        return event_tracking.sendMB('logs-view-raw')
      }
    }

    $scope.openClearCacheModal = function() {
      let modalInstance
      return (modalInstance = $modal.open({
        templateUrl: 'clearCacheModalTemplate',
        controller: 'ClearCacheModalController',
        scope: $scope
      }))
    }

    return ($scope.syncToCode = position =>
      synctex.syncToCode(position).then(function(data) {
        const { doc, line } = data
        return ide.editorManager.openDoc(doc, { gotoLine: line })
      }))
  })

  App.factory('synctex', function(ide, $http, $q) {
    // enable per-user containers by default
    const perUserCompile = true

    const synctex = {
      syncToPdf(cursorPosition) {
        const deferred = $q.defer()

        const doc_id = ide.editorManager.getCurrentDocId()
        if (doc_id == null) {
          deferred.reject()
          return deferred.promise
        }
        const doc = ide.fileTreeManager.findEntityById(doc_id)
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
        let v
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
      return synctex
        .syncToPdf(this.cursorPosition)
        .then(highlights => ($scope.pdf.highlights = highlights))
    }

    ide.$scope.$on('cursor:editor:syncToPdf', $scope.syncToPdf)

    return ($scope.syncToCode = () =>
      synctex
        .syncToCode($scope.pdf.position, {
          includeVisualOffset: true,
          fromPdfPosition: true
        })
        .then(function(data) {
          const { doc, line } = data
          return ide.editorManager.openDoc(doc, { gotoLine: line })
        }))
  })

  App.controller(
    'PdfLogEntryController',
    ($scope, ide, event_tracking) =>
      ($scope.openInEditor = function(entry) {
        let column, line
        event_tracking.sendMBOnce('logs-jump-to-location-once')
        const entity = ide.fileTreeManager.findEntityByPath(entry.file)
        if (entity == null || entity.type !== 'doc') {
          return
        }
        if (entry.line != null) {
          ;({ line } = entry)
        }
        if (entry.column != null) {
          ;({ column } = entry)
        }
        return ide.editorManager.openDoc(entity, {
          gotoLine: line,
          gotoColumn: column
        })
      })
  )

  return App.controller('ClearCacheModalController', function(
    $scope,
    $modalInstance
  ) {
    $scope.state = { inflight: false }

    $scope.clear = function() {
      $scope.state.inflight = true
      return $scope.clearCache().then(function() {
        $scope.state.inflight = false
        return $modalInstance.close()
      })
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  })
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
