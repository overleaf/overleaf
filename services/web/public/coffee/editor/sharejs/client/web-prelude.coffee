# This file is included at the top of the compiled client-side javascript

# This way all the modules can add stuff to exports, and for the web client they'll all get exported.
window.sharejs = exports =
  'version': '0.5.0'

# This is compiled out when compiled with uglifyjs, but its important for the share.uncompressed.js.
#
# Maybe I should rename WEB to __SHAREJS_WEB or something, but its only relevant for testing
# anyway.
if typeof WEB == 'undefined'
  # This will put WEB in the global scope in a browser.
  window.WEB = true
