import { useTranslation } from 'react-i18next'
import { GlobalToastGeneratorEntry } from '@/features/ide-react/components/global-toasts'

const CONNECTION_RESTORED_TOAST_HANDLE = 'connection-restored'

const ConnectionRestoredToastContent = () => {
  const { t } = useTranslation()
  return <span>{t('youre_back_online')}</span>
}

const generators: GlobalToastGeneratorEntry[] = [
  {
    key: 'connection-restored',
    generator: () => ({
      content: <ConnectionRestoredToastContent />,
      type: 'success',
      autoHide: true,
      delay: 5000,
    }),
  },
]

export default generators

export const showConnectionRestoredToast = () => {
  window.dispatchEvent(
    new CustomEvent('ide:show-toast', {
      detail: {
        key: 'connection-restored',
        handle: CONNECTION_RESTORED_TOAST_HANDLE,
      },
    })
  )
}
