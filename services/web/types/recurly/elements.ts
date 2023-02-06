export interface CardElementChangeState {
  brand: string
  cvv: {
    empty: boolean
    focus: boolean
    valid: boolean
  }
  empty: boolean
  expiry: {
    empty: boolean
    focus: boolean
    valid: boolean
  }
  firstSix: string
  focus: boolean
  lastFour: string
  number: {
    empty: boolean
    focus: boolean
    valid: boolean
  }
  valid: boolean
}
