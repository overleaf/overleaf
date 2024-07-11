import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'

function EmptyState() {
  const { t } = useTranslation()

  return (
    <div className="rp-empty-state">
      <div className="rp-empty-state-inner">
        <div className="rp-empty-state-comment-icon">
          <MaterialIcon type="question_answer" />
        </div>
        <p>
          <strong>{t('no_comments_or_suggestions')}</strong>
        </p>
        <p>{t('no_one_has_commented_or_left_any_suggestions_yet')}</p>
      </div>
    </div>
  )
}

export default EmptyState
