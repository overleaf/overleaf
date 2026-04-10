import SplitTestHandler from '../SplitTests/SplitTestHandler.mjs'

const SYSTEM_THEME_USER_CUTOFF_DATE = new Date(Date.UTC(2026, 2, 2, 12, 0, 0)) // 12pm GMT on March 2, 2026

async function getOverallTheme(req, res, user) {
  if (user.ace.overallTheme != null) {
    return user.ace.overallTheme
  }

  if (user.signUpDate < SYSTEM_THEME_USER_CUTOFF_DATE) {
    // default / dark
    return ''
  }

  const systemOverallSplitTestAssignment =
    await SplitTestHandler.promises.getAssignment(
      req,
      res,
      'new-user-system-overall-theme'
    )

  if (systemOverallSplitTestAssignment.variant === 'system') {
    return 'system'
  }

  // default / dark
  return ''
}

async function buildUserSettings(req, res, user) {
  return {
    mode: user.ace.mode,
    editorTheme: user.ace.theme,
    editorLightTheme: user.ace.lightTheme,
    editorDarkTheme: user.ace.darkTheme,
    fontSize: user.ace.fontSize,
    autoComplete: user.ace.autoComplete,
    autoPairDelimiters: user.ace.autoPairDelimiters,
    pdfViewer: user.ace.pdfViewer,
    syntaxValidation: user.ace.syntaxValidation,
    previewTabs: user.ace.previewTabs ?? false,
    fontFamily: user.ace.fontFamily || 'lucida',
    lineHeight: user.ace.lineHeight || 'normal',
    overallTheme: await getOverallTheme(req, res, user),
    mathPreview: user.ace.mathPreview,
    breadcrumbs: user.ace.breadcrumbs,
    nonBlinkingCursor: user.ace.nonBlinkingCursor ?? false,
    referencesSearchMode: user.ace.referencesSearchMode,
    darkModePdf: user.ace.darkModePdf ?? false,
    zotero: user.ace.zotero,
    mendeley: user.ace.mendeley,
    papers: user.ace.papers,
  }
}

export default {
  buildUserSettings,
}
