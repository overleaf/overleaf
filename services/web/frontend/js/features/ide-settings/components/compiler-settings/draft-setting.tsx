import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useCallback, useMemo } from 'react'
import DropdownSetting from '../dropdown-setting'
import { useEditorAnalytics } from '@/shared/hooks/use-editor-analytics'
import { useFeatureFlag } from '@/shared/context/split-test-context'

type CompileMode = 'normal' | 'png2pdf' | 'fast_draft'

export default function DraftSetting() {
  const { draft, setDraft, png2pdf, setPng2pdf } = useCompileContext()
  const { t } = useTranslation()
  const { sendEvent } = useEditorAnalytics()
  const png2pdfEnabled = useFeatureFlag('png2pdf')

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
      setDraft(value === 'fast_draft')
      setPng2pdf(value === 'png2pdf')
    },
    [sendEvent, setDraft, setPng2pdf]
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
