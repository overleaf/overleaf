import { useTranslation } from 'react-i18next'
import { UserEmailData } from '../../../../../../../types/user-email'
import { useUserEmailsContext } from '../../../context/user-email-context'
import { postJSON } from '../../../../../infrastructure/fetch-json'
import { UseAsyncReturnType } from '../../../../../shared/hooks/use-async'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLIconButton, {
  OLIconButtonProps,
} from '@/shared/components/ol/ol-icon-button'
import getMeta from '@/utils/meta'

type DeleteButtonProps = Pick<
  OLIconButtonProps,
  'disabled' | 'isLoading' | 'onClick'
>

function DeleteButton({ disabled, isLoading, onClick }: DeleteButtonProps) {
  const { t } = useTranslation()

  return (
    <OLIconButton
      variant="danger"
      disabled={disabled}
      isLoading={isLoading}
      size="sm"
      onClick={onClick}
      accessibilityLabel={t('remove') || ''}
      icon="delete"
    />
  )
}

type RemoveProps = {
  userEmailData: UserEmailData
  deleteEmailAsync: UseAsyncReturnType
}

function Remove({ userEmailData, deleteEmailAsync }: RemoveProps) {
  const { t } = useTranslation()
  const { state, deleteEmail, setLoading } = useUserEmailsContext()
  const isManaged = getMeta('ol-isManagedAccount')

  const getTooltipText = () => {
    if (isManaged) {
      return t('your_account_is_managed_by_your_group_admin')
    }
    return userEmailData.default
      ? t('please_change_primary_to_remove')
      : t('remove')
  }

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
        // Reset the global loading state before this row is unmounted
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }

  if (deleteEmailAsync.isLoading) {
    return <DeleteButton isLoading />
  }

  return (
    <OLTooltip
      id={userEmailData.email}
      description={getTooltipText()}
      overlayProps={{ placement: userEmailData.default ? 'left' : 'top' }}
    >
      <span>
        <DeleteButton
          disabled={state.isLoading || userEmailData.default}
          onClick={handleRemoveUserEmail}
        />
      </span>
    </OLTooltip>
  )
}

export default Remove
