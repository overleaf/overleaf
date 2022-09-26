import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useProjectListContext } from '../context/project-list-context'

export default function LoadMore() {
  const {
    visibleProjects,
    hiddenProjects,
    loadMoreCount,
    showAllProjects,
    loadMoreProjects,
  } = useProjectListContext()
  const { t } = useTranslation()

  return (
    <div className="text-centered">
      {hiddenProjects.length > 0 ? (
        <Button
          bsStyle="info"
          className="project-list-load-more-button"
          onClick={() => loadMoreProjects()}
          aria-label={t('show_x_more_projects', { x: loadMoreCount })}
        >
          {t('show_x_more', { x: loadMoreCount })}
        </Button>
      ) : null}
      <p>
        {hiddenProjects.length > 0 ? (
          <>
            <span aria-live="polite">
              {t('showing_x_out_of_n_projects', {
                x: visibleProjects.length,
                n: visibleProjects.length + hiddenProjects.length,
              })}
            </span>{' '}
            <button
              type="button"
              onClick={() => showAllProjects()}
              style={{ padding: 0 }}
              className="btn-link"
              aria-label={t('show_all_projects')}
            >
              {t('show_all_uppercase')}
            </button>
          </>
        ) : (
          <span aria-live="polite">
            {t('showing_x_out_of_n_projects', {
              x: visibleProjects.length,
              n: visibleProjects.length,
            })}
          </span>
        )}
      </p>
    </div>
  )
}
