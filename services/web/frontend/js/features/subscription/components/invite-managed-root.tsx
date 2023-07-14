import { JSXElementConstructor } from 'react'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'

const [inviteManagedModule] = importOverleafModules(
  'managedGroupEnrollmentInvite'
)
const InviteManaged: JSXElementConstructor<Record<string, never>> =
  inviteManagedModule?.import.default

export default function InviteManagedRoot() {
  return <InviteManaged />
}
