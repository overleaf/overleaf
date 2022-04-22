import Icon from '../../../../../shared/components/icon'
import Tooltip from '../../../../../shared/components/tooltip'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { UserEmailData } from '../../../../../../../types/user-email'
import { useUserEmailsContext } from '../../../context/user-email-context'
import { postJSON } from '../../../../../infrastructure/fetch-json'
import { UseAsyncReturnType } from '../../../../../shared/hooks/use-async'

function DeleteButton({ children, disabled, onClick }: Button.ButtonProps) {
  return (
    <Button
      bsSize="small"
      bsStyle="danger"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

type RemoveProps = {
  userEmailData: UserEmailData
  deleteEmailAsync: UseAsyncReturnType
}

function Remove({ userEmailData, deleteEmailAsync }: RemoveProps) {
  const { t } = useTranslation()
  const { state, deleteEmail } = useUserEmailsContext()

  const handleRemoveUserEmail = () => {
    deleteEmailAsync
      .runAsync(
        postJSON('/user/emails/delete', {
          body: {
            email: userEmailData.email,
          },
        })
      )
      .then(() => {
        deleteEmail(userEmailData.email)
      })
      .catch(() => {})
  }

  if (deleteEmailAsync.isLoading) {
    return <DeleteButton disabled>{t('deleting')}...</DeleteButton>
  }

  return (
    <Tooltip
      id={userEmailData.email}
      description={
        userEmailData.default
          ? t('please_change_primary_to_remove')
          : t('remove')
      }
      overlayProps={{ placement: userEmailData.default ? 'left' : 'top' }}
    >
      <span>
        <DeleteButton
          disabled={state.isLoading || userEmailData.default}
          onClick={handleRemoveUserEmail}
        >
          <Icon
            type="trash"
            fw
            accessibilityLabel={
              userEmailData.default
                ? t('please_change_primary_to_remove')
                : t('remove')
            }
          />
        </DeleteButton>
      </span>
    </Tooltip>
  )
}

export default Remove
