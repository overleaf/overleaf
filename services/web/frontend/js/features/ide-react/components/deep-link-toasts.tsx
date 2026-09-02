import { GlobalToastGeneratorEntry } from '@/features/ide-react/components/global-toasts'
import { useTranslation } from 'react-i18next'

const COMMENT_NOT_FOUND_KEY = 'comment:not-found'

export const CommentNotFoundToast = () => {
  const { t } = useTranslation()

  return <span>{t('comment_not_found')}</span>
}

const generators: GlobalToastGeneratorEntry[] = [
  {
    key: COMMENT_NOT_FOUND_KEY,
    generator: () => ({
      content: <CommentNotFoundToast />,
      type: 'warning',
      autoHide: true,
      delay: 4000,
      isDismissible: true,
    }),
  },
]

export default generators

export const showCommentNotFoundToast = () => {
  window.dispatchEvent(
    new CustomEvent('ide:show-toast', {
      detail: {
        key: COMMENT_NOT_FOUND_KEY,
      },
    })
  )
}
