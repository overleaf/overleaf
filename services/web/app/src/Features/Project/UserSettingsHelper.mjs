import SplitTestHandler from '../SplitTests/SplitTestHandler.mjs'

// Copied from services/web/frontend/js/features/ide-redesign/utils/new-editor-utils.ts
const SPLIT_TEST_USER_CUTOFF_DATE = new Date(Date.UTC(2025, 8, 23, 13, 0, 0)) // 2pm British Summer Time on September 23, 2025
const NEW_USER_CUTOFF_DATE = new Date(Date.UTC(2025, 10, 12, 12, 0, 0)) // 12pm GMT on November 12, 2025

async function getEnableNewEditorLegacyDefault(req, res, user) {
  if (req.query['existing-user-override'] === 'true') {
    return false
  }

  if (req.query['skip-new-user-check'] === 'true') {
    return true
  }

  if (user.signUpDate >= NEW_USER_CUTOFF_DATE) {
    return true
  }

  if (user.signUpDate >= SPLIT_TEST_USER_CUTOFF_DATE) {
    const assignment = await SplitTestHandler.promises.getAssignment(
      req,
      res,
      'editor-redesign-new-users'
    )

    return assignment.variant !== 'default'
  }

  return false
}

async function buildUserSettings(req, res, user) {
  const defaultLegacyEnableNewEditor = await getEnableNewEditorLegacyDefault(
    req,
    res,
    user
  )

  const enableNewEditorStageFour = user.ace.enableNewEditorStageFour ?? true
  const enableNewEditorLegacy =
    user.ace.enableNewEditor ?? defaultLegacyEnableNewEditor

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
    fontFamily: user.ace.fontFamily || 'lucida',
    lineHeight: user.ace.lineHeight || 'normal',
    overallTheme: user.ace.overallTheme,
    mathPreview: user.ace.mathPreview,
    breadcrumbs: user.ace.breadcrumbs,
    referencesSearchMode: user.ace.referencesSearchMode,
    enableNewEditor: enableNewEditorStageFour,
    enableNewEditorLegacy,
    darkModePdf: user.ace.darkModePdf ?? false,
  }
}

export default {
  buildUserSettings,
}
