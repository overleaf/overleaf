ace.define("ace/snippets/csound_document",[], function(require, exports, module) {
"use strict";

exports.snippetText = "# <CsoundSynthesizer>\n\
snippet synth\n\
	<CsoundSynthesizer>\n\
	<CsInstruments>\n\
	${1}\n\
	</CsInstruments>\n\
	<CsScore>\n\
	e\n\
	</CsScore>\n\
	</CsoundSynthesizer>\n\
";
exports.scope = "csound_document";

});
                (function() {
                    ace.require(["ace/snippets/csound_document"], function(m) {
                        if (typeof module == "object" && typeof exports == "object" && module) {
                            module.exports = m;
                        }
                    });
                })();
            