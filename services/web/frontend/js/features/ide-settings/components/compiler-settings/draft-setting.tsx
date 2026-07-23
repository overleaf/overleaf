import getMeta from '../../../../utils/meta'
import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useCallback, useMemo } from 'react'
import DropdownSetting from '../dropdown-setting'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useProjectSettingsContext } from '@/features/ide-settings/context/project-settings-context'

type CompileMode = 'normal' | 'png2pdf' | 'fast_draft'

export default function DraftSetting() {
  const { draft, setDraft, png2pdf, setPng2pdf } = useCompileContext()
  const { setPng2pdf: persistPng2pdf } = useProjectSettingsContext()
  const { t } = useTranslation()
  const { sendEvent } = useEditorAnalytics()
  const png2pdfEnabled = getMeta('ol-canUsePng2Pdf')

  // The three modes are mutually exclusive, derived from the two underlying flags.
  const mode: CompileMode = png2pdf
    ? 'png2pdf'
    : draft
      ? 'fast_draft'
      : 'normal'

  const changeMode = useCallback(
    (value: CompileMode) => {
      sendEvent('recompile-setting-changed', {
        setting: 'compile-mode',
        settingVal: value,
      })
      const enablePng2pdf = value === 'png2pdf'
      setDraft(value === 'fast_draft')
      setPng2pdf(enablePng2pdf)
      // Draft mode is a local-only setting, so don't overwrite the project-wide
      // png2pdf preference (shared with all collaborators) when a user just
      // toggles draft for themselves. Only persist when the user explicitly
      // picks Normal or Fast [optimize images].
      if (value !== 'fast_draft') {
        persistPng2pdf(enablePng2pdf)
      }
    },
    [sendEvent, setDraft, setPng2pdf, persistPng2pdf]
  )

  const options = useMemo(
    () => [
      { label: t('normal'), value: 'normal' as const },
      ...(png2pdfEnabled
        ? [{ label: t('fast_optimize_images'), value: 'png2pdf' as const }]
        : []),
      { label: t('fast_draft'), value: 'fast_draft' as const },
    ],
    [t, png2pdfEnabled]
  )

  return (
    <DropdownSetting
      id="draft"
      label={t('compile_mode')}
      options={options}
      description={t('switch_compile_mode_for_faster_draft_compilation')}
      value={mode}
      onChange={changeMode}
      width={png2pdfEnabled ? 'wide' : 'default'}
    />
  )
}
