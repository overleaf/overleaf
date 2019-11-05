ace.define("ace/mode/csp_highlight_rules",[], function(require, exports, module) {
    "use strict";

    var oop = require("../lib/oop");
    var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    var CspHighlightRules = function() {
        var keywordMapper = this.createKeywordMapper({
            "constant.language": "child-src|connect-src|default-src|font-src|frame-src|img-src|manifest-src|media-src|object-src"
                  + "|script-src|style-src|worker-src|base-uri|plugin-types|sandbox|disown-opener|form-action|frame-ancestors|report-uri"
                  + "|report-to|upgrade-insecure-requests|block-all-mixed-content|require-sri-for|reflected-xss|referrer|policy-uri",
            "variable": "'none'|'self'|'unsafe-inline'|'unsafe-eval'|'strict-dynamic'|'unsafe-hashed-attributes'"
        }, "identifier", true);

        this.$rules = {
            start: [{
                token: "string.link",
                regex: /https?:[^;\s]*/
            }, {
                token: "operator.punctuation",
                regex: /;/
            }, {
                token: keywordMapper,
                regex: /[^\s;]+/
            }]
        };
    };

    oop.inherits(CspHighlightRules, TextHighlightRules);

    exports.CspHighlightRules = CspHighlightRules;
});

ace.define("ace/mode/csp",[], function(require, exports, module) {
    "use strict";

    var TextMode = require("./text").Mode;
    var CspHighlightRules = require("./csp_highlight_rules").CspHighlightRules;
    var oop = require("../lib/oop");

    var Mode = function() {
        this.HighlightRules = CspHighlightRules;
    };

    oop.inherits(Mode, TextMode);

    (function() {
        this.$id = "ace/mode/csp";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
                (function() {
                    ace.require(["ace/mode/csp"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            