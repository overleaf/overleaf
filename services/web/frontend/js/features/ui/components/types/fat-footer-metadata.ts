import type { SubdomainLang } from '@/features/ui/components/types/fat-footer'

export type FatFooterMetadata = {
  subdomainLang?: SubdomainLang
  translatedLanguages: { [key: string]: string }
  currentLangCode: string
}
