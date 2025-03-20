import { useTranslation } from 'react-i18next'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useCallback, useMemo } from 'react'
import * as eventTracking from '../../../../../infrastructure/event-tracking'
import DropdownSetting from '../dropdown-setting'

export default function DraftSetting() {
  const { draft, setDraft } = useCompileContext()
  const { t } = useTranslation()

  const sendEventAndSet = useCallback(
    (value: boolean) => {
      eventTracking.sendMB('recompile-setting-changed', {
        setting: 'compile-mode',
        settingVal: value,
      })
      setDraft(value)
    },
    [setDraft]
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
      onChange={sendEventAndSet}
    />
  )
}
