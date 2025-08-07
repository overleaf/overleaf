import BetaProgramSection from '../../js/features/settings/components/beta-program-section'
import { UserProvider } from '../../js/shared/context/user-context'

export const SectionNotEnrolled = args => {
  window.metaAttributesCache.set('ol-user', { betaProgram: false })

  return (
    <UserProvider>
      <BetaProgramSection {...args} />
    </UserProvider>
  )
}

export const SectionEnrolled = args => {
  window.metaAttributesCache.set('ol-user', { betaProgram: true })

  return (
    <UserProvider>
      <BetaProgramSection {...args} />
    </UserProvider>
  )
}

export default {
  title: 'Account Settings / Beta program',
  component: BetaProgramSection,
}
