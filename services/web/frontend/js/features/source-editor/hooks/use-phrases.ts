import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'

export const usePhrases = (): Record<string, string> => {
  const { t } = useTranslation()

  return useMemo(() => {
    return {
      'Fold line': t('fold_line'),
      'Unfold line': t('unfold_line'),
      'Learn more': t('learn_more'),
      'Hide document preamble': t('hide_document_preamble'),
      'Show document preamble': t('show_document_preamble'),
      'End of document': t('end_of_document'),
    }
  }, [t])
}
