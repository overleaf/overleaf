export interface SubdomainDetails {
  lngCode: string
  url: string
}

export interface SubdomainLang {
  [subdomain: string]: SubdomainDetails
}
