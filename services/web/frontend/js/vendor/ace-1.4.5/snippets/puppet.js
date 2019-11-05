ace.define("ace/snippets/puppet",[], function(require, exports, module) {
"use strict";

exports.snippetText =undefined;
exports.scope = "puppet";

});
                (function() {
                    ace.require(["ace/snippets/puppet"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            