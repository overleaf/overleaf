import 'jquery'
import 'angular'
import 'angular-sanitize'
import 'lodash'
import 'libs/angular-autocomplete/angular-autocomplete'
import 'libs/ui-bootstrap'
import 'libs/ng-context-menu-0.1.4'
import 'libs/jquery.storage'
import 'libs/angular-cookie'
import 'libs/passfield'
import 'libs/ng-tags-input-3.0.0'
import 'libs/select/select'

// CSS
import 'angular/angular-csp.css'

// Polyfill fetch for IE11
import 'isomorphic-unfetch'

// Rewrite meta elements
import './utils/meta'

// Configure dynamically loaded assets (via webpack) to be downloaded from CDN
// See: https://webpack.js.org/guides/public-path/#on-the-fly
// eslint-disable-next-line no-undef, camelcase
__webpack_public_path__ = window.baseAssetPath
