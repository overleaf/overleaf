import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'
import ButtonSetting from '../button-setting'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useRailContext } from '@/features/ide-redesign/contexts/rail-context'

export default function DictionarySetting() {
  const { t } = useTranslation()
  const { setActiveModal } = useRailContext()

  // TODO ide-redesign-cleanup: leftMenu is a misnomer, in the
  // redesign it refers to the settings modal
  const { setLeftMenuShown } = useLayoutContext()

  const onClick = useCallback(() => {
    setActiveModal('dictionary')
    setLeftMenuShown(false)
  }, [setLeftMenuShown, setActiveModal])

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
