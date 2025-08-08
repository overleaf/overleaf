export interface SubdomainDetails {
  hide?: boolean
  lngCode: string
  url: string
}

export interface SubdomainLang {
  [subdomain: string]: SubdomainDetails
}
