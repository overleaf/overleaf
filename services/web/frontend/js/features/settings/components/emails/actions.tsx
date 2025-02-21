import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import MakePrimary from './actions/make-primary/make-primary'
import Remove from './actions/remove'
import useAsync from '../../../../shared/hooks/use-async'
import { useUserEmailsContext } from '../../context/user-email-context'
import { UserEmailData } from '../../../../../../types/user-email'

type ActionsProps = {
  userEmailData: UserEmailData
  primary?: UserEmailData
}

function Actions({ userEmailData, primary }: ActionsProps) {
  const { t } = useTranslation()
  const { setLoading: setUserEmailsContextLoading } = useUserEmailsContext()
  const makePrimaryAsync = useAsync()
  const deleteEmailAsync = useAsync()

  useEffect(() => {
    setUserEmailsContextLoading(
      makePrimaryAsync.isLoading || deleteEmailAsync.isLoading
    )
  }, [
    setUserEmailsContextLoading,
    makePrimaryAsync.isLoading,
    deleteEmailAsync.isLoading,
  ])

  useEffect(() => {
    if (makePrimaryAsync.isLoading && !deleteEmailAsync.isIdle) {
      deleteEmailAsync.reset()
    }
  }, [makePrimaryAsync.isLoading, deleteEmailAsync])

  useEffect(() => {
    if (deleteEmailAsync.isLoading && !makePrimaryAsync.isIdle) {
      makePrimaryAsync.reset()
    }
  }, [deleteEmailAsync.isLoading, makePrimaryAsync])

  return (
    <>
      <MakePrimary
        userEmailData={userEmailData}
        primary={primary}
        makePrimaryAsync={makePrimaryAsync}
      />{' '}
      <Remove
        userEmailData={userEmailData}
        deleteEmailAsync={deleteEmailAsync}
      />
      {(makePrimaryAsync.isError || deleteEmailAsync.isError) && (
        <div className="text-danger small">
          {t('generic_something_went_wrong')}
        </div>
      )}
    </>
  )
}

export default Actions
