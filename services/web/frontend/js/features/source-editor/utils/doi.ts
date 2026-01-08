const doiRe = /10\.\d{4,}\/\S+/

export const containsDOI = (text: string) =>
  doiRe.test(decodeURIComponent(text))
