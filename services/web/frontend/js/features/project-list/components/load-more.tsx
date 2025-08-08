import { useTranslation } from 'react-i18next'
import { useProjectListContext } from '../context/project-list-context'
import OLButton from '@/shared/components/ol/ol-button'

export default function LoadMore() {
  const {
    visibleProjects,
    hiddenProjectsCount,
    loadMoreCount,
    showAllProjects,
    loadMoreProjects,
  } = useProjectListContext()
  const { t } = useTranslation()

  return (
    <div className="text-center">
      {hiddenProjectsCount > 0 ? (
        <>
          <OLButton
            variant="secondary"
            className="project-list-load-more-button"
            onClick={() => loadMoreProjects()}
          >
            {t('show_x_more_projects', { x: loadMoreCount })}
          </OLButton>
        </>
      ) : null}
      <p>
        {hiddenProjectsCount > 0 ? (
          <>
            <span aria-live="polite">
              {t('showing_x_out_of_n_projects', {
                x: visibleProjects.length,
                n: visibleProjects.length + hiddenProjectsCount,
              })}
            </span>{' '}
            <OLButton
              variant="link"
              onClick={() => showAllProjects()}
              className="btn-inline-link"
            >
              {t('show_all_projects')}
            </OLButton>
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
