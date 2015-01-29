/*
 *  /MathJax/jax/output/HTML-CSS/autoload/ms.js
 *
 *  Copyright (c) 2009-2014 The MathJax Consortium
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

MathJax.Hub.Register.StartupHook("HTML-CSS Jax Ready",function(){var c="2.4.0";var a=MathJax.ElementJax.mml,b=MathJax.OutputJax["HTML-CSS"];a.ms.Augment({toHTML:function(e){e=this.HTMLhandleSize(this.HTMLcreateSpan(e));var d=this.getValues("lquote","rquote");var f=this.data.join("");this.HTMLhandleVariant(e,this.HTMLgetVariant(),d.lquote+f+d.rquote);this.HTMLhandleSpace(e);this.HTMLhandleColor(e);this.HTMLhandleDir(e);return e}});a.ms.prototype.defaults.mathvariant="monospace";MathJax.Hub.Startup.signal.Post("HTML-CSS ms Ready");MathJax.Ajax.loadComplete(b.autoloadDir+"/ms.js")});
