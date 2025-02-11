import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'

export type RequireAcceptData = {
  projectName?: string
}

export const RequireAcceptScreen: FC<{
  requireAcceptData: RequireAcceptData
  sendPostRequest: (confirmedByUser: boolean) => void
}> = ({ requireAcceptData, sendPostRequest }) => {
  const { t } = useTranslation()
  const user = getMeta('ol-user')

  return (
    <div className="container">
      <div className="row">
        <div className="col-md-12">
          <div className="card">
            <div className="card-body">
              <div className="text-center link-sharing-invite">
                <div className="link-sharing-invite-header">
                  <p>
                    {t('youre_joining')}
                    <br />
                    <em>
                      <strong>
                        {requireAcceptData.projectName || 'This project'}
                      </strong>
                    </em>
                    {user && (
                      <>
                        <br />
                        {t('as_email', { email: user.email })}
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="row row-spaced text-center">
                <div className="col-md-12">
                  <p>
                    {t(
                      'your_name_and_email_address_will_be_visible_to_the_project_owner_and_other_editors'
                    )}
                  </p>
                </div>
              </div>

              <div className="row row-spaced text-center">
                <div className="col-md-12">
                  <button
                    className="btn btn-lg btn-primary"
                    type="submit"
                    onClick={() => sendPostRequest(true)}
                  >
                    {t('ok_join_project')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
