import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useMemo } from 'react'
import DropdownSetting from '../dropdown-setting'
import { useSetCompilationSettingWithEvent } from '@/features/editor-left-menu/hooks/use-set-compilation-setting'

export default function DraftSetting() {
  const { draft, setDraft } = useCompileContext()
  const { t } = useTranslation()
  const changeDraft = useSetCompilationSettingWithEvent(
    'compile-mode',
    setDraft
  )

  const options = useMemo(
    () => [
      { label: t('normal'), value: false },
      {
        label: t('fast_draft'),
        value: true,
      },
    ],
    [t]
  )

  return (
    <DropdownSetting
      id="draft"
      label={t('compile_mode')}
      options={options}
      description={t('switch_compile_mode_for_faster_draft_compilation')}
      value={draft}
      onChange={changeDraft}
    />
  )
}
