import { GlobalToastGeneratorEntry } from '@/features/ide-react/components/global-toasts'
import { useTranslation } from 'react-i18next'

const CompositionDiscardedToast = ({ text }: { text?: string }) => {
  const { t } = useTranslation()

  return (
    <>
      <p>
        <b>{t('input_not_applied')}</b>
      </p>
      {text ? <p>“{text}”</p> : null}
      {t('input_discarded_due_to_simultaneous_edit')}
    </>
  )
}

const generators: GlobalToastGeneratorEntry[] = [
  {
    key: 'composition:discarded',
    generator: ({ text }: { text?: string }) => ({
      content: <CompositionDiscardedToast text={text} />,
      type: 'warning',
      autoHide: true,
      delay: 8000,
      isDismissible: true,
    }),
  },
]

export default generators
