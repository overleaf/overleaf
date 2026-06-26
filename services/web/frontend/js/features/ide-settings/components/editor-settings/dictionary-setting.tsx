import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import ButtonSetting from '../button-setting'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useRailContext } from '@/features/ide-react/context/rail-context'

export default function DictionarySetting() {
  const { t } = useTranslation()
  const { setActiveModal } = useRailContext()

  const { setSettingsShown } = useLayoutContext()

  const onClick = useCallback(() => {
    setActiveModal('dictionary')
    setSettingsShown(false)
  }, [setSettingsShown, setActiveModal])

  return (
    <ButtonSetting
      id="dictionary-settings"
      label={t('dictionary')}
      description={t('edit_your_custom_dictionary')}
      buttonText={t('edit')}
      onClick={onClick}
    />
  )
}
