const SYSTEM_THEME_USER_CUTOFF_DATE = new Date(Date.UTC(2026, 2, 2, 12, 0, 0)) // 12pm GMT on March 2, 2026

function getOverallTheme(user) {
  if (user.ace.overallTheme != null) {
    return user.ace.overallTheme
  }

  if (user.signUpDate < SYSTEM_THEME_USER_CUTOFF_DATE) {
    // default / dark
    return ''
  }

  return 'system'
}

/**
 * Build the settings for a reference provider (zotero, mendeley, papers).
 *
 * The group entries are rebuilt explicitly so that the `_id` stored on older
 * documents doesn't leak to the frontend, which posts these settings back to us
 * unchanged.
 *
 * @param {object | undefined} settings the provider settings from `user.ace`
 */
function buildRefProviderSettings(settings) {
  if (settings == null) {
    return settings
  }
  return {
    enabled: settings.enabled,
    disablePersonalLibrary: settings.disablePersonalLibrary,
    groups: (settings.groups ?? []).map(group => ({ id: group.id })),
  }
}

function getInitialTheme(overallThemeSetting) {
  switch (overallThemeSetting) {
    case 'light-':
      return 'light'
    case '':
      return 'dark'
    case 'system':
      return 'system'
    default:
      return 'dark'
  }
}

async function buildUserSettings(_req, _res, user) {
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
    overallTheme: getOverallTheme(user),
    mathPreview: user.ace.mathPreview,
    breadcrumbs: user.ace.breadcrumbs,
    editorTabs: user.ace.editorTabs ?? true,
    nonBlinkingCursor: user.ace.nonBlinkingCursor ?? false,
    referencesSearchMode: user.ace.referencesSearchMode,
    darkModePdf: user.ace.darkModePdf ?? false,
    floatingMenu: user.ace.floatingMenu ?? true,
    zotero: buildRefProviderSettings(user.ace.zotero),
    mendeley: buildRefProviderSettings(user.ace.mendeley),
    papers: buildRefProviderSettings(user.ace.papers),
  }
}

export default {
  buildUserSettings,
  getInitialTheme,
}
