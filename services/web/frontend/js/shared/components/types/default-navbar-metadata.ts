import type {
  NavbarItemData,
  NavbarSessionUser,
} from '@/shared/components/types/navbar'

export type DefaultNavbarMetadata = {
  customLogo?: string
  title?: string
  canDisplayAdminMenu: boolean
  canDisplayAdminRedirect: boolean
  canDisplayProjectUrlLookup: boolean
  canDisplaySplitTestMenu: boolean
  canDisplaySurveyMenu: boolean
  canDisplayScriptLogMenu: boolean
  enableUpgradeButton: boolean
  suppressNavbarRight: boolean
  suppressNavContentLinks: boolean
  showCloseIcon?: boolean
  showSubscriptionLink: boolean
  showSignUpLink: boolean
  currentUrl: string
  sessionUser?: NavbarSessionUser
  adminUrl?: string
  items: NavbarItemData[]
}
