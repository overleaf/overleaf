import { ProjectContextMember } from '@/shared/context/types/project-context'
import { useTranslation } from 'react-i18next'

export default function MemberPrivileges({
  privileges,
}: {
  privileges: ProjectContextMember['privileges']
}) {
  const { t } = useTranslation()

  switch (privileges) {
    case 'readAndWrite':
      return t('editor')

    case 'readOnly':
      return t('viewer')

    case 'review':
      return t('reviewer')

    default:
      return null
  }
}
