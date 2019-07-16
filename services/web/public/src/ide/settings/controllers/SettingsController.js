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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.controller('SettingsController', function($scope, settings, ide, _) {
    $scope.overallThemesList = window.overallThemes
    $scope.ui = { loadingStyleSheet: false }

    const _updateCSSFile = function(theme) {
      $scope.ui.loadingStyleSheet = true
      const docHeadEl = document.querySelector('head')
      const oldStyleSheetEl = document.getElementById('main-stylesheet')
      const newStyleSheetEl = document.createElement('link')
      newStyleSheetEl.addEventListener('load', e => {
        return $scope.$applyAsync(() => {
          $scope.ui.loadingStyleSheet = false
          return docHeadEl.removeChild(oldStyleSheetEl)
        })
      })
      newStyleSheetEl.setAttribute('rel', 'stylesheet')
      newStyleSheetEl.setAttribute('id', 'main-stylesheet')
      newStyleSheetEl.setAttribute('href', theme.path)
      return docHeadEl.appendChild(newStyleSheetEl)
    }

    if (!['default', 'vim', 'emacs'].includes($scope.settings.mode)) {
      $scope.settings.mode = 'default'
    }

    if (!['pdfjs', 'native'].includes($scope.settings.pdfViewer)) {
      $scope.settings.pdfViewer = 'pdfjs'
    }

    if (
      $scope.settings.fontFamily != null &&
      !['monaco', 'lucida'].includes($scope.settings.fontFamily)
    ) {
      delete $scope.settings.fontFamily
    }

    if (
      $scope.settings.lineHeight != null &&
      !['compact', 'normal', 'wide'].includes($scope.settings.lineHeight)
    ) {
      delete $scope.settings.lineHeight
    }

    $scope.fontSizeAsStr = function(newVal) {
      if (newVal != null) {
        $scope.settings.fontSize = newVal
      }
      return $scope.settings.fontSize.toString()
    }

    $scope.$watch('settings.editorTheme', (editorTheme, oldEditorTheme) => {
      if (editorTheme !== oldEditorTheme) {
        return settings.saveSettings({ editorTheme })
      }
    })

    $scope.$watch('settings.overallTheme', (overallTheme, oldOverallTheme) => {
      if (overallTheme !== oldOverallTheme) {
        const chosenTheme = _.find(
          $scope.overallThemesList,
          theme => theme.val === overallTheme
        )
        if (chosenTheme != null) {
          _updateCSSFile(chosenTheme)
          return settings.saveSettings({ overallTheme })
        }
      }
    })

    $scope.$watch('settings.fontSize', (fontSize, oldFontSize) => {
      if (fontSize !== oldFontSize) {
        return settings.saveSettings({ fontSize: parseInt(fontSize, 10) })
      }
    })

    $scope.$watch('settings.mode', (mode, oldMode) => {
      if (mode !== oldMode) {
        return settings.saveSettings({ mode })
      }
    })

    $scope.$watch('settings.autoComplete', (autoComplete, oldAutoComplete) => {
      if (autoComplete !== oldAutoComplete) {
        return settings.saveSettings({ autoComplete })
      }
    })

    $scope.$watch(
      'settings.autoPairDelimiters',
      (autoPairDelimiters, oldAutoPairDelimiters) => {
        if (autoPairDelimiters !== oldAutoPairDelimiters) {
          return settings.saveSettings({ autoPairDelimiters })
        }
      }
    )

    $scope.$watch('settings.pdfViewer', (pdfViewer, oldPdfViewer) => {
      if (pdfViewer !== oldPdfViewer) {
        return settings.saveSettings({ pdfViewer })
      }
    })

    $scope.$watch(
      'settings.syntaxValidation',
      (syntaxValidation, oldSyntaxValidation) => {
        if (syntaxValidation !== oldSyntaxValidation) {
          return settings.saveSettings({ syntaxValidation })
        }
      }
    )

    $scope.$watch('settings.fontFamily', (fontFamily, oldFontFamily) => {
      if (fontFamily !== oldFontFamily) {
        return settings.saveSettings({ fontFamily })
      }
    })

    $scope.$watch('settings.lineHeight', (lineHeight, oldLineHeight) => {
      if (lineHeight !== oldLineHeight) {
        return settings.saveSettings({ lineHeight })
      }
    })

    $scope.$watch('project.spellCheckLanguage', (language, oldLanguage) => {
      if (this.ignoreUpdates) {
        return
      }
      if (oldLanguage != null && language !== oldLanguage) {
        settings.saveProjectSettings({ spellCheckLanguage: language })
        // Also set it as the default for the user
        return settings.saveSettings({ spellCheckLanguage: language })
      }
    })

    $scope.$watch('project.compiler', (compiler, oldCompiler) => {
      if (this.ignoreUpdates) {
        return
      }
      if (oldCompiler != null && compiler !== oldCompiler) {
        return settings.saveProjectSettings({ compiler })
      }
    })

    $scope.$watch('project.imageName', (imageName, oldImageName) => {
      if (this.ignoreUpdates) {
        return
      }
      if (oldImageName != null && imageName !== oldImageName) {
        return settings.saveProjectSettings({ imageName })
      }
    })

    $scope.$watch('project.rootDoc_id', (rootDoc_id, oldRootDoc_id) => {
      if (this.ignoreUpdates) {
        return
      }
      // don't save on initialisation, Angular passes oldRootDoc_id as
      // undefined in this case.
      if (typeof oldRootDoc_id === 'undefined') {
        return
      }
      // otherwise only save changes, null values are allowed
      if (rootDoc_id !== oldRootDoc_id) {
        return settings.saveProjectSettings({ rootDocId: rootDoc_id })
      }
    })

    ide.socket.on('compilerUpdated', compiler => {
      this.ignoreUpdates = true
      $scope.$apply(() => {
        return ($scope.project.compiler = compiler)
      })
      return delete this.ignoreUpdates
    })

    ide.socket.on('imageNameUpdated', imageName => {
      this.ignoreUpdates = true
      $scope.$apply(() => {
        return ($scope.project.imageName = imageName)
      })
      return delete this.ignoreUpdates
    })

    return ide.socket.on('spellCheckLanguageUpdated', languageCode => {
      this.ignoreUpdates = true
      $scope.$apply(() => {
        return ($scope.project.spellCheckLanguage = languageCode)
      })
      return delete this.ignoreUpdates
    })
  }))
