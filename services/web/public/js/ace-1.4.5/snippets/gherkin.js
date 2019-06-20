ace.define("ace/snippets/gherkin",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "gherkin";

});
                (function() {
                    ace.require(["ace/snippets/gherkin"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            