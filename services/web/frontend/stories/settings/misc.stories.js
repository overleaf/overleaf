import MiscSection from '../../js/features/settings/components/misc-section'
import { UserProvider } from '../../js/shared/context/user-context'

export const Section = args => {
  window.metaAttributesCache.set('ol-user', { betaProgram: true })

  return (
    <UserProvider>
      <MiscSection {...args} />
    </UserProvider>
  )
}

export default {
  title: 'Account Settings / Misc / Section',
  component: MiscSection,
}
