import { ProjectMember } from '@/shared/context/types/project-metadata'
import { useTranslation } from 'react-i18next'

export default function MemberPrivileges({
  privileges,
  allowCopy,
}: {
  privileges: ProjectMember['privileges']
  allowCopy?: boolean
}) {
  const { t } = useTranslation()

  switch (privileges) {
    case 'readAndWrite':
      return t('editor')

    case 'readOnly':
      return allowCopy === false ? 'Viewer (no copy)' : 'Viewer (can copy)'

    case 'review':
      return t('reviewer')

    default:
      return null
  }
}
