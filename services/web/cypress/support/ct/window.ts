window.i18n = { currentLangCode: 'en' }
window.ExposedSettings = {
  appName: 'Overleaf',
  validRootDocExtensions: ['tex', 'Rtex', 'ltx', 'Rnw'],
  fileIgnorePattern:
    '**/{{__MACOSX,.git,.texpadtmp,.R}{,/**},.!(latexmkrc),*.{dvi,aux,log,toc,out,pdfsync,synctex,synctex(busy),fdb_latexmk,fls,nlo,ind,glo,gls,glg,bbl,blg,doc,docx,gz,swp}}',
} as typeof window.ExposedSettings
