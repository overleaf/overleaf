ace.define("ace/snippets/perl6",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "perl6";

});
                (function() {
                    ace.require(["ace/snippets/perl6"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            