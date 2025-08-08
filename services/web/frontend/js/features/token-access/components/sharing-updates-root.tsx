import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import { Trans, useTranslation } from 'react-i18next'
import withErrorBoundary from '@/infrastructure/error-boundary'
import { GenericErrorBoundaryFallback } from '@/shared/components/generic-error-boundary-fallback'
import { useCallback, useState } from 'react'
import getMeta from '@/utils/meta'
import { postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import useAsync from '@/shared/hooks/use-async'
import Notification from '@/shared/components/notification'
import { sendMB } from '@/infrastructure/event-tracking'

import LeaveProjectModal from './leave-project-modal'
import OLButton from '@/shared/components/ol/ol-button'
import { useLocation } from '@/shared/hooks/use-location'

function SharingUpdatesRoot() {
  const [showModal, setShowModal] = useState(false)
  const { isReady } = useWaitForI18n()
  const { t } = useTranslation()
  const { isLoading, isSuccess, isError, runAsync } = useAsync()
  const projectId = getMeta('ol-project_id')

  const location = useLocation()
  const joinProject = useCallback(() => {
    sendMB('notification-click', {
      name: 'link-sharing-collaborator',
      button: 'ok',
    })
    runAsync(postJSON(`/project/${projectId}/sharing-updates/join`))
      .then(() => {
        location.assign(`/project/${projectId}`)
      })
      .catch(debugConsole.error)
  }, [runAsync, projectId, location])

  const viewProject = useCallback(() => {
    sendMB('notification-click', {
      name: 'link-sharing-collaborator',
      button: 'anonymous',
    })
    runAsync(postJSON(`/project/${projectId}/sharing-updates/view`))
      .then(() => {
        location.assign(`/project/${projectId}`)
      })
      .catch(debugConsole.error)
  }, [runAsync, projectId, location])

  const leaveProject = useCallback(() => {
    sendMB('notification-click', {
      name: 'link-sharing-collaborator',
      button: 'leave',
    })
    runAsync(postJSON(`/project/${projectId}/leave`))
      .then(() => {
        location.assign('/project')
      })
      .catch(debugConsole.error)
  }, [runAsync, projectId, location])

  if (!isReady) {
    return null
  }

  return (
    <div className="container">
      <LeaveProjectModal
        handleLeaveAction={leaveProject}
        showModal={showModal}
        handleCloseModal={() => setShowModal(false)}
      />
      <div className="row">
        <div className="col-md-6 col-md-offset-3 offset-md-3">
          <div className="card sharing-updates">
            <div className="card-body">
              <div className="row">
                <div className="col-md-12">
                  <h1 className="sharing-updates-h1">
                    {t('updates_to_project_sharing')}
                  </h1>
                </div>
              </div>

              <div className="row row-spaced">
                <div className="col-md-12">
                  <p>
                    <Trans
                      i18nKey="were_making_some_changes_to_project_sharing_this_means_you_will_be_visible"
                      components={[
                        // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                        <a
                          href="/blog/changes-to-project-sharing"
                          rel="noopener noreferrer"
                          target="_blank"
                          onClick={() => {
                            sendMB('notification-click', {
                              name: 'link-sharing-collaborator',
                              button: 'learn',
                            })
                          }}
                        />,
                      ]}
                    />
                  </p>
                </div>
              </div>

              <div className="row row-spaced">
                <div className="col-md-12">
                  <OLButton
                    variant="primary"
                    onClick={joinProject}
                    disabled={isLoading}
                  >
                    {t('ok_continue_to_project')}
                  </OLButton>
                </div>
              </div>

              {isError && (
                <div className="row row-spaced">
                  <div className="col-md-12">
                    <Notification
                      type="error"
                      content={t('generic_something_went_wrong')}
                    />
                  </div>
                </div>
              )}

              <div className="row row-spaced">
                <div className="col-md-12">
                  <p>
                    <small>
                      <Trans
                        i18nKey="you_can_also_choose_to_view_anonymously_or_leave_the_project"
                        components={[
                          // eslint-disable-next-line react/jsx-key
                          <button
                            className="btn btn-inline-link"
                            onClick={() => viewProject()}
                            disabled={isLoading || isSuccess}
                          />,
                          // eslint-disable-next-line react/jsx-key
                          <button
                            className="btn btn-inline-link"
                            onClick={() => setShowModal(true)}
                            disabled={isLoading || isSuccess}
                          />,
                        ]}
                      />
                    </small>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(SharingUpdatesRoot, () => (
  <GenericErrorBoundaryFallback />
))
