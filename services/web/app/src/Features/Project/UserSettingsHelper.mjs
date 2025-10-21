function buildUserSettings(user) {
  return {
    mode: user.ace.mode,
    editorTheme: user.ace.theme,
    fontSize: user.ace.fontSize,
    autoComplete: user.ace.autoComplete,
    autoPairDelimiters: user.ace.autoPairDelimiters,
    pdfViewer: user.ace.pdfViewer,
    syntaxValidation: user.ace.syntaxValidation,
    fontFamily: user.ace.fontFamily || 'lucida',
    lineHeight: user.ace.lineHeight || 'normal',
    overallTheme: user.ace.overallTheme,
    mathPreview: user.ace.mathPreview,
    breadcrumbs: user.ace.breadcrumbs,
    referencesSearchMode: user.ace.referencesSearchMode,
    enableNewEditor: user.ace.enableNewEditor ?? true,
  }
}

export default {
  buildUserSettings,
}
