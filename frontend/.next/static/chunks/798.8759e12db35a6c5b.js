"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[798],{9798:function(e,t,r){let i,o,a,n;r.d(t,{Networks:function(){return v.pt},StellarWalletsKit:function(){return th}});var l,s,c,d,u,p,f,g,m,h=r(6642),b=r(9080),w=function(e,t,r,i){var o;t[0]=0;for(var a=1;a<t.length;a++){var n=t[a++],l=t[a]?(t[0]|=n?1:2,r[t[a++]]):t[++a];3===n?i[0]=l:4===n?i[1]=Object.assign(i[1]||{},l):5===n?(i[1]=i[1]||{})[t[++a]]=l:6===n?i[1][t[++a]]+=l+"":n?(o=e.apply(l,w(e,l,r,["",null])),i.push(o),l[0]?t[0]|=2:(t[a-2]=0,t[a]=o)):i.push(l)}return i},x=new Map,y=(function(e){var t=x.get(this);return t||(t=new Map,x.set(this,t)),(t=w(this,t.get(e)||(t.set(e,t=function(e){for(var t,r,i=1,o="",a="",n=[0],l=function(e){1===i&&(e||(o=o.replace(/^\s*\n\s*|\s*\n\s*$/g,"")))?n.push(0,e,o):3===i&&(e||o)?(n.push(3,e,o),i=2):2===i&&"..."===o&&e?n.push(4,e,0):2===i&&o&&!e?n.push(5,0,!0,o):i>=5&&((o||!e&&5===i)&&(n.push(i,0,o,r),i=6),e&&(n.push(i,e,0,r),i=6)),o=""},s=0;s<e.length;s++){s&&(1===i&&l(),l(s));for(var c=0;c<e[s].length;c++)t=e[s][c],1===i?"<"===t?(l(),n=[n],i=3):o+=t:4===i?"--"===o&&">"===t?(i=1,o=""):o=t+o[0]:a?t===a?a="":o+=t:'"'===t||"'"===t?a=t:">"===t?(l(),i=1):i&&("="===t?(i=5,r=o,o=""):"/"===t&&(i<5||">"===e[s][c+1])?(l(),3===i&&(n=n[0]),i=n,(n=n[0]).push(2,0,i),i=0):" "===t||"	"===t||"\n"===t||"\r"===t?(l(),i=2):o+=t),3===i&&"!--"===o&&(i=4,n=n[0])}return l(),n}(e)),t),arguments,[])).length>1?t:t[0]}).bind(b.h),v=r(5275),k=r(8657),$=r(2338);let C=globalThis.localStorage,S=globalThis.document;function A(e){return[...e.v,(e.i?"!":"")+e.n].join(":")}function L(e,t=","){return e.map(A).join(t)}(0,h.cE)(()=>{if(S)for(let[e,t]of Object.entries(k.rS.value))S.documentElement.style.setProperty(`--swk-${e}`,t)}),(0,h.cE)(()=>{if(C&&k.yZ.value)try{let e=C.getItem(v.dR.usedWalletsIds),t=e?new Set(JSON.parse(e)):new Set;t.has(k.yZ.value.productId)&&t.delete(k.yZ.value.productId),C.setItem(v.dR.usedWalletsIds,JSON.stringify([k.yZ.value.productId,...t]))}catch(e){console.error(e)}}),(0,h.cE)(()=>{C&&(k.Lt.value?C.setItem(v.dR.activeAddress,k.Lt.value):C.removeItem(v.dR.activeAddress),k.F5.value?C.setItem(v.dR.selectedModuleId,k.F5.value):C.removeItem(v.dR.selectedModuleId),void 0!==k.ei.value&&C.setItem(v.dR.hardwareWalletPaths,JSON.stringify(k.ei.value)),void 0!==k.NC.value&&C.setItem(v.dR.wcSessionPaths,JSON.stringify(k.NC.value)))});let T="undefined"!=typeof CSS&&CSS.escape||(e=>e.replace(/[!"'`*+.,;:\\/<=>?@#$%&^|~()[\]{}]/g,"\\$&").replace(/^\d/,"\\3$& "));function z(e){for(var t=9,r=e.length;r--;)t=Math.imul(t^e.charCodeAt(r),1597334677);return"#"+((t^t>>>9)>>>0).toString(36)}function E(e,t="@media "){return t+F(e).map(e=>("string"==typeof e&&(e={min:e}),e.raw||Object.keys(e).map(t=>`(${t}-width:${e[t]})`).join(" and "))).join(",")}function F(e=[]){return Array.isArray(e)?e:null==e?[]:[e]}function O(e){return e}function M(){}let W={d:0,b:134217728,c:268435456,a:671088640,u:805306368,o:939524096};function j(e){return e.match(/[-=:;]/g)?.length||0}function R(e){return Math.min(/(?:^|width[^\d]+)(\d+(?:.\d+)?)(p)?/.test(e)?Math.max(0,29.63*(+RegExp.$1/(RegExp.$2?15:1))**.137-43):0,15)<<22|Math.min(j(e),15)<<18}let D=["rst-c","st-ch","h-chi","y-lin","nk","sited","ecked","pty","ad-on","cus-w","ver","cus","cus-v","tive","sable","tiona","quire"];function I({n:e,i:t,v:r=[]},i,o,a){for(let n of(e&&(e=A({n:e,i:t,v:r})),a=[...F(a)],r)){let e=i.theme("screens",n);for(let t of F(e&&E(e)||i.v(n)))a.push(t),o|=e?67108864|R(t):"dark"==n?1073741824:"@"==t[0]?R(t):1<<~(/:([a-z-]+)/.test(t)&&~D.indexOf(RegExp.$1.slice(2,7))||-18)}return{n:e,p:o,r:a,i:t}}let P=new Map;function V(e){if(e.d){let t=[],r=H(e.r.reduce((e,r)=>"@"==r[0]?(t.push(r),e):r?H(e,e=>H(r,t=>{let r=/(:merge\(.+?\))(:[a-z-]+|\\[.+])/.exec(t);if(r){let i=e.indexOf(r[1]);return~i?e.slice(0,i)+r[0]+e.slice(i+r[1].length):N(e,t)}return N(t,e)})):e,"&"),t=>N(t,e.n?"."+T(e.n):""));return r&&t.push(r.replace(/:merge\((.+?)\)/g,"$1")),t.reduceRight((e,t)=>t+"{"+e+"}",e.d)}}function H(e,t){return e.replace(/ *((?:\(.+?\)|\[.+?\]|[^,])+) *(,|$)/g,(e,r,i)=>t(r)+i)}function N(e,t){return e.replace(/&/g,t)}let U=new Intl.Collator("en",{numeric:!0});function _(e,t){for(var r=0,i=e.length;r<i;){let o=i+r>>1;0>=B(e[o],t)?r=o+1:i=o}return i}function B(e,t){let r=e.p&W.o;return r==(t.p&W.o)&&(r==W.b||r==W.o)?0:e.p-t.p||e.o-t.o||U.compare(Z(e.n),Z(t.n))||U.compare(J(e.n),J(t.n))}function Z(e){return(e||"").split(/:/).pop().split("/").pop()||"\0"}function J(e){return(e||"").replace(/\W/g,e=>String.fromCharCode(127+e.charCodeAt(0)))+"\0"}function q(e,t){return Math.round(parseInt(e,16)*t)}function G(e,t={}){if("function"==typeof e)return e(t);let{opacityValue:r="1",opacityVariable:i}=t,o=i?`var(${i})`:r;if(e.includes("<alpha-value>"))return e.replace("<alpha-value>",o);if("#"==e[0]&&(4==e.length||7==e.length)){let t=(e.length-1)/3,r=[17,1,.062272][t-1];return`rgba(${[q(e.substr(1,t),r),q(e.substr(1+t,t),r),q(e.substr(1+2*t,t),r),o]})`}return"1"==o?e:"0"==o?"#0000":e.replace(/^(rgb|hsl)(\([^)]+)\)$/,`$1a$2,${o})`)}function Y(e,t,r,i,o=[]){return function e(t,{n:r,p:i,r:o=[],i:a},n){let l=[],s="",c=0,d=0;for(let f in t||{}){var u,p;let g=t[f];if("@"==f[0]){if(!g)continue;if("a"==f[1]){l.push(...ee(r,i,eo(""+g),n,i,o,a,!0));continue}if("l"==f[1]){for(let t of F(g))l.push(...e(t,{n:r,p:(u=W[f[7]],i&~W.o|u),r:"d"==f[7]?[]:o,i:a},n));continue}if("i"==f[1]){l.push(...F(g).map(e=>({p:-1,o:0,r:[],d:f+" "+e})));continue}if("k"==f[1]){l.push({p:W.d,o:0,r:[f],d:e(g,{p:W.d},n).map(V).join("")});continue}if("f"==f[1]){l.push(...F(g).map(t=>({p:W.d,o:0,r:[f],d:e(t,{p:W.d},n).map(V).join("")})));continue}}if("object"!=typeof g||Array.isArray(g))"label"==f&&g?r=g+z(JSON.stringify([i,a,t])):(g||0===g)&&(f=f.replace(/[A-Z]/g,e=>"-"+e.toLowerCase()),d+=1,c=Math.max(c,"-"==(p=f)[0]?0:j(p)+(/^(?:(border-(?!w|c|sty)|[tlbr].{2,4}m?$|c.{7,8}$)|([fl].{5}l|g.{8}$|pl))/.test(p)?+!!RegExp.$1||-!!RegExp.$2:0)+1),s+=(s?";":"")+F(g).map(e=>n.s(f,X(""+e,n.theme)+(a?" !important":""))).join(";"));else if("@"==f[0]||f.includes("&")){let t=i;"@"==f[0]&&(f=f.replace(/\bscreen\(([^)]+)\)/g,(e,r)=>{let i=n.theme("screens",r);return i?(t|=67108864,E(i,"")):e}),t|=R(f)),l.push(...e(g,{n:r,p:t,r:[...o,f],i:a},n))}else l.push(...e(g,{p:i,r:[...o,f]},n))}return l.unshift({n:r,p:i,o:Math.max(0,15-d)+1.5*Math.min(c||15,15),r:o,d:s}),l.sort(B)}(e,I(t,r,i,o),r)}function X(e,t){return e.replace(/theme\((["'`])?(.+?)\1(?:\s*,\s*(["'`])?(.+?)\3)?\)/g,(e,r,i,o,a="")=>{let n=t(i,a);return"function"==typeof n&&/color|fill|stroke/i.test(i)?G(n):""+F(n).filter(e=>Object(e)!==e)})}function K(e,t){let r;let i=[];for(let o of e)o.d&&o.n?r?.p==o.p&&""+r.r==""+o.r?(r.c=[r.c,o.c].filter(Boolean).join(" "),r.d=r.d+";"+o.d):i.push(r={...o,n:o.n&&t}):i.push({...o,n:o.n&&t});return i}function Q(e,t,r=W.u,i,o){let a=[];for(let n of e)for(let e of function(e,t,r,i,o){let a=function(e,t){let r=P.get(e.n);return r?r(e,t):t.r(e.n,"dark"==e.v[0])}(e={...e,i:e.i||o},t);return a?"string"==typeof a?({r:i,p:r}=I(e,t,r,i),K(Q(eo(a),t,r,i,e.i),e.n)):Array.isArray(a)?a.map(e=>{var t,o;return{o:0,...e,r:[...F(i),...F(e.r)],p:(t=r,o=e.p??r,t&~W.o|o)}}):Y(a,e,t,r,i):[{c:A(e),p:0,o:0,r:[]}]}(n,t,r,i,o))a.splice(_(a,e),0,e);return a}function ee(e,t,r,i,o,a,n,l){return K((l?r.flatMap(e=>Q([e],i,o,a,n)):Q(r,i,o,a,n)).map(e=>e.p&W.o&&(e.n||t==W.b)?{...e,p:e.p&~W.o|t,o:0}:e),e)}function et(e,t,r){if("("!=e[e.length-1]){let r=[],i=!1,o=!1,a="";for(let t of e)if(!("("==t||/[~@]$/.test(t))){if("!"==t[0]&&(t=t.slice(1),i=!i),t.endsWith(":")){r["dark:"==t?"unshift":"push"](t.slice(0,-1));continue}"-"==t[0]&&(t=t.slice(1),o=!o),t.endsWith("-")&&(t=t.slice(0,-1)),t&&"&"!=t&&(a+=(a&&"-")+t)}a&&(o&&(a="-"+a),t[0].push({n:a,v:r.filter(er),i:i}))}}function er(e,t,r){return r.indexOf(e)==t}let ei=new Map;function eo(e){let t=ei.get(e);if(!t){let r=[],i=[[]],o=0,a=0,n=null,l=0,s=(t,a=0)=>{o!=l&&(r.push(e.slice(o,l+a)),t&&et(r,i)),o=l+1};for(;l<e.length;l++){let t=e[l];if(a)"\\"!=e[l-1]&&(a+=+("["==t)||-("]"==t));else if("["==t)a+=1;else if(n)"\\"!=e[l-1]&&n.test(e.slice(l))&&(n=null,o=l+RegExp.lastMatch.length);else if("/"==t&&"\\"!=e[l-1]&&("*"==e[l+1]||"/"==e[l+1]))n="*"==e[l+1]?/^\*\//:/^[\r\n]/;else if("("==t)s(),r.push(t);else if(":"==t)":"!=e[l+1]&&s(!1,1);else if(/[\s,)]/.test(t)){s(!0);let e=r.lastIndexOf("(");if(")"==t){let t=r[e-1];if(/[~@]$/.test(t)){let o=i.shift();r.length=e,et([...r,"#"],i);let{v:a}=i[0].pop();for(let e of o)e.v.splice(+("dark"==e.v[0])-+("dark"==a[0]),a.length);et([...r,function(e,t,r,i){var o;return o=(e,o)=>{let{n:a,p:n,r:l,i:s}=I(e,o,t);return r&&ee(a,t,r,o,n,l,s,i)},P.set(e,o),e}(t.length>1?t.slice(0,-1)+z(JSON.stringify([t,o])):t+"("+L(o)+")",W.a,o,/@$/.test(t))],i)}e=r.lastIndexOf("(",e-1)}r.length=e+1}else/[~@]/.test(t)&&"("==e[l+1]&&i.unshift([])}s(!0),ei.set(e,t=i[0])}return t}function ea(e,t,r){return t.reduce((t,i,o)=>t+r(i)+e[o+1],e[0])}function en(e,t){return Array.isArray(e)&&Array.isArray(e.raw)?ea(e,t,e=>el(e).trim()):t.filter(Boolean).reduce((e,t)=>e+el(t),e?el(e):"")}function el(e){let t,r="";if(e&&"object"==typeof e){if(Array.isArray(e))(t=en(e[0],e.slice(1)))&&(r+=" "+t);else for(let t in e)e[t]&&(r+=" "+t)}else null!=e&&"boolean"!=typeof e&&(r+=" "+e);return r}function es(e,t){return Array.isArray(e)?ed(ea(e,t,e=>null!=e&&"boolean"!=typeof e?e:"")):"string"==typeof e?ed(e):[e]}let ec=/ *(?:(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}))/g;function ed(e){let t;e=e.replace(/\/\*[^]*?\*\/|\s\s+|\n/gm," ");let r=[{}],i=[r[0]],o=[];for(;t=ec.exec(e);)t[4]&&(r.shift(),o.shift()),t[3]?(o.unshift(t[3]),r.unshift({}),i.push(o.reduce((e,t)=>({[t]:e}),r[0]))):t[4]||(r[0][t[1]]&&(r.unshift({}),i.push(o.reduce((e,t)=>({[t]:e}),r[0]))),r[0][t[1]]=t[2]);return i}function eu(e,...t){var r;let i=es(e,t),o=(i.find(e=>e.label)?.label||"css")+z(JSON.stringify(i));return r=(e,t)=>K(i.flatMap(r=>Y(r,e,t,W.o)),o),P.set(o,r),o}function ep(e,t,r){return[e,ef(t,r)]}function ef(e,t){return"function"==typeof e?e:"string"==typeof e&&/^[\w-]+$/.test(e)?(r,i)=>({[e]:t?t(r,i):eg(r,1)}):t=>e||{[t[1]]:eg(t,2)}}function eg(e,t,r=e.slice(t).find(Boolean)||e.$$||e.input){return"-"==e.input[0]?`calc(${r} * -1)`:r}function em(e,t,r,i){let o;return[e,(o="string"==typeof r?(e,t)=>({[r]:i?i(e,t):e._}):r||(({1:e,_:t},r,i)=>({[e||i]:t})),(e,r)=>{let i=ex(t||e[1]),a=r.theme(i,e.$$)??ew(e.$$,i,r);if(null!=a)return e._=eg(e,0,a),o(e,r,i)})]}function eh(e,t={},r){return[e,function(e={},t){return(r,i)=>{let{section:o=ex(r[0]).replace("-","")+"Color"}=e,[a,n]=(r.$$.match(/^(\[[^\]]+]|[^/]+?)(?:\/(.+))?$/)||[]).slice(1);if(!a)return;let l=i.theme(o,a)||ew(a,o,i);if(!l||"object"==typeof l)return;let{opacityVariable:s=`--tw-${r[0].replace(/-$/,"")}-opacity`,opacitySection:c=o.replace("Color","Opacity"),property:d=o,selector:u}=e,p=i.theme(c,n||"DEFAULT")||n&&ew(n,c,i),f=t||(({_:e})=>{let t=eb(d,e);return u?{[u]:t}:t});r._={value:G(l,{opacityVariable:s||void 0,opacityValue:p||void 0}),color:e=>G(l,e),opacityVariable:s||void 0,opacityValue:p||void 0};let g=f(r,i);if(!r.dark){let e=i.d(o,a,l);e&&e!==l&&(r._={value:G(e,{opacityVariable:s||void 0,opacityValue:p||"1"}),color:t=>G(e,t),opacityVariable:s||void 0,opacityValue:p||void 0},g={"&":g,[i.v("dark")]:f(r,i)})}return g}}(t,r)]}function eb(e,t){let r={};return"string"==typeof t?r[e]=t:(t.opacityVariable&&t.value.includes(t.opacityVariable)&&(r[t.opacityVariable]=t.opacityValue||"1"),r[e]=t.value),r}function ew(e,t,r){if("["==e[0]&&"]"==e.slice(-1)){if(e=ey(X(e.slice(1,-1),r.theme)),!t)return e;if(!(/color|fill|stroke/i.test(t)&&!(/^color:/.test(e)||/^(#|((hsl|rgb)a?|hwb|lab|lch|color)\(|[a-z]+$)/.test(e))||/image/i.test(t)&&!(/^image:/.test(e)||/^[a-z-]+\(/.test(e))||/weight/i.test(t)&&!(/^(number|any):/.test(e)||/^\d+$/.test(e))||/position/i.test(t)&&/^(length|size):/.test(e)))return e.replace(/^[a-z-]+:/,"")}}function ex(e){return e.replace(/-./g,e=>e[1].toUpperCase())}function ey(e){return e.includes("url(")?e.replace(/(.*?)(url\(.*?\))(.*?)/g,(e,t="",r,i="")=>ey(t)+r+ey(i)):e.replace(/(^|[^\\])_+/g,(e,t)=>t+" ".repeat(e.length-t.length)).replace(/\\_/g,"_").replace(/(calc|min|max|clamp)\(.+\)/g,e=>e.replace(/(-?\d*\.?\d(?!\b-.+[,)](?![^+\-/*])\D)(?:%|[a-z]+)?|\))([+\-/*])/g,"$1 $2 "))}function ev(e,...t){return L(eo(en(e,t))," ")}function ek({presets:e=[],...t}){let r={darkMode:void 0,darkColor:void 0,preflight:!1!==t.preflight&&[],theme:{},variants:F(t.variants),rules:F(t.rules),ignorelist:F(t.ignorelist),hash:void 0,stringify:(e,t)=>e+":"+t,finalize:[]};for(let i of F([...e,{darkMode:t.darkMode,darkColor:t.darkColor,preflight:!1!==t.preflight&&F(t.preflight),theme:t.theme,hash:t.hash,stringify:t.stringify,finalize:t.finalize}])){let{preflight:e,darkMode:t=r.darkMode,darkColor:o=r.darkColor,theme:a,variants:n,rules:l,ignorelist:s,hash:c=r.hash,stringify:d=r.stringify,finalize:u}="function"==typeof i?i(r):i;r={preflight:!1!==r.preflight&&!1!==e&&[...r.preflight,...F(e)],darkMode:t,darkColor:o,theme:{...r.theme,...a,extend:{...r.theme.extend,...a?.extend}},variants:[...r.variants,...F(n)],rules:[...r.rules,...F(l)],ignorelist:[...r.ignorelist,...F(s)],hash:c,stringify:d,finalize:[...r.finalize,...F(u)]}}return r}function e$(e,t,r,i,o,a){for(let n of t){let t=r.get(n);t||r.set(n,t=i(n));let l=t(e,o,a);if(l)return l}}function eC(e){var t;return eA(e[0],"function"==typeof(t=e[1])?t:()=>t)}function eS(e){var t,r;return Array.isArray(e)?eA(e[0],ef(e[1],e[2])):eA(e,ef(t,r))}function eA(e,t){return eL(e,(e,r,i,o)=>{let a=r.exec(e);if(a)return a.$$=e.slice(a[0].length),a.dark=o,t(a,i)})}function eL(e,t){let r=F(e).map(eT);return(e,i,o)=>{for(let a of r){let r=t(e,a,i,o);if(r)return r}}}function eT(e){return"string"==typeof e?RegExp("^"+e+(e.includes("$")||"-"==e.slice(-1)?"":"$")):e}let ez=new Proxy(M,{apply:(e,t,r)=>i(r[0]),get(e,t){let r=i[t];return"function"==typeof r?function(){return r.apply(i,arguments)}:r}}),eE=function e(t){return new Proxy(function(e,...r){return eF(t,"",e,r)},{get:(r,i)=>"bind"===i?e:i in r?r[i]:function(e,...r){return eF(t,i,e,r)}})}();function eF(e,t,r,i){return{toString(){let o=T(t+z(JSON.stringify([t,es(r,i)])));return("function"==typeof e?e:ez)(eu({[`@keyframes ${o}`]:es(r,i)})),o}}}var eO=new Map([["align-self","-ms-grid-row-align"],["color-adjust","-webkit-print-color-adjust"],["column-gap","grid-column-gap"],["forced-color-adjust","-ms-high-contrast-adjust"],["gap","grid-gap"],["grid-template-columns","-ms-grid-columns"],["grid-template-rows","-ms-grid-rows"],["justify-self","-ms-grid-column-align"],["margin-inline-end","-webkit-margin-end"],["margin-inline-start","-webkit-margin-start"],["mask-border","-webkit-mask-box-image"],["mask-border-outset","-webkit-mask-box-image-outset"],["mask-border-slice","-webkit-mask-box-image-slice"],["mask-border-source","-webkit-mask-box-image-source"],["mask-border-repeat","-webkit-mask-box-image-repeat"],["mask-border-width","-webkit-mask-box-image-width"],["overflow-wrap","word-wrap"],["padding-inline-end","-webkit-padding-end"],["padding-inline-start","-webkit-padding-start"],["print-color-adjust","color-adjust"],["row-gap","grid-row-gap"],["scroll-margin-bottom","scroll-snap-margin-bottom"],["scroll-margin-left","scroll-snap-margin-left"],["scroll-margin-right","scroll-snap-margin-right"],["scroll-margin-top","scroll-snap-margin-top"],["scroll-margin","scroll-snap-margin"],["text-combine-upright","-ms-text-combine-horizontal"]]);let eM=[["-webkit-",1],["-moz-",2],["-ms-",4]],eW={screens:{sm:"640px",md:"768px",lg:"1024px",xl:"1280px","2xl":"1536px"},columns:{auto:"auto","3xs":"16rem","2xs":"18rem",xs:"20rem",sm:"24rem",md:"28rem",lg:"32rem",xl:"36rem","2xl":"42rem","3xl":"48rem","4xl":"56rem","5xl":"64rem","6xl":"72rem","7xl":"80rem"},spacing:{px:"1px",0:"0px",...eD(4,"rem",4,.5,.5),...eD(12,"rem",4,5),14:"3.5rem",...eD(64,"rem",4,16,4),72:"18rem",80:"20rem",96:"24rem"},durations:{75:"75ms",100:"100ms",150:"150ms",200:"200ms",300:"300ms",500:"500ms",700:"700ms",1e3:"1000ms"},animation:{none:"none",spin:"spin 1s linear infinite",ping:"ping 1s cubic-bezier(0,0,0.2,1) infinite",pulse:"pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",bounce:"bounce 1s infinite"},aspectRatio:{auto:"auto",square:"1/1",video:"16/9"},backdropBlur:eI("blur"),backdropBrightness:eI("brightness"),backdropContrast:eI("contrast"),backdropGrayscale:eI("grayscale"),backdropHueRotate:eI("hueRotate"),backdropInvert:eI("invert"),backdropOpacity:eI("opacity"),backdropSaturate:eI("saturate"),backdropSepia:eI("sepia"),backgroundColor:eI("colors"),backgroundImage:{none:"none"},backgroundOpacity:eI("opacity"),backgroundSize:{auto:"auto",cover:"cover",contain:"contain"},blur:{none:"none",0:"0",sm:"4px",DEFAULT:"8px",md:"12px",lg:"16px",xl:"24px","2xl":"40px","3xl":"64px"},brightness:{...eD(200,"",100,0,50),...eD(110,"",100,90,5),75:"0.75",125:"1.25"},borderColor:({theme:e})=>({DEFAULT:e("colors.gray.200","currentColor"),...e("colors")}),borderOpacity:eI("opacity"),borderRadius:{none:"0px",sm:"0.125rem",DEFAULT:"0.25rem",md:"0.375rem",lg:"0.5rem",xl:"0.75rem","2xl":"1rem","3xl":"1.5rem","1/2":"50%",full:"9999px"},borderSpacing:eI("spacing"),borderWidth:{DEFAULT:"1px",...eR(8,"px")},boxShadow:{sm:"0 1px 2px 0 rgba(0,0,0,0.05)",DEFAULT:"0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)",md:"0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",lg:"0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",xl:"0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)","2xl":"0 25px 50px -12px rgba(0,0,0,0.25)",inner:"inset 0 2px 4px 0 rgba(0,0,0,0.05)",none:"0 0 #0000"},boxShadowColor:eI("colors"),caretColor:eI("colors"),accentColor:({theme:e})=>({auto:"auto",...e("colors")}),contrast:{...eD(200,"",100,0,50),75:"0.75",125:"1.25"},content:{none:"none"},divideColor:eI("borderColor"),divideOpacity:eI("borderOpacity"),divideWidth:eI("borderWidth"),dropShadow:{sm:"0 1px 1px rgba(0,0,0,0.05)",DEFAULT:["0 1px 2px rgba(0,0,0,0.1)","0 1px 1px rgba(0,0,0,0.06)"],md:["0 4px 3px rgba(0,0,0,0.07)","0 2px 2px rgba(0,0,0,0.06)"],lg:["0 10px 8px rgba(0,0,0,0.04)","0 4px 3px rgba(0,0,0,0.1)"],xl:["0 20px 13px rgba(0,0,0,0.03)","0 8px 5px rgba(0,0,0,0.08)"],"2xl":"0 25px 25px rgba(0,0,0,0.15)",none:"0 0 #0000"},fill:({theme:e})=>({...e("colors"),none:"none"}),grayscale:{DEFAULT:"100%",0:"0"},hueRotate:{0:"0deg",15:"15deg",30:"30deg",60:"60deg",90:"90deg",180:"180deg"},invert:{DEFAULT:"100%",0:"0"},flex:{1:"1 1 0%",auto:"1 1 auto",initial:"0 1 auto",none:"none"},flexBasis:({theme:e})=>({...e("spacing"),...ej(2,6),...ej(12,12),auto:"auto",full:"100%"}),flexGrow:{DEFAULT:1,0:0},flexShrink:{DEFAULT:1,0:0},fontFamily:{sans:'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"'.split(","),serif:'ui-serif,Georgia,Cambria,"Times New Roman",Times,serif'.split(","),mono:'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace'.split(",")},fontSize:{xs:["0.75rem","1rem"],sm:["0.875rem","1.25rem"],base:["1rem","1.5rem"],lg:["1.125rem","1.75rem"],xl:["1.25rem","1.75rem"],"2xl":["1.5rem","2rem"],"3xl":["1.875rem","2.25rem"],"4xl":["2.25rem","2.5rem"],"5xl":["3rem","1"],"6xl":["3.75rem","1"],"7xl":["4.5rem","1"],"8xl":["6rem","1"],"9xl":["8rem","1"]},fontWeight:{thin:"100",extralight:"200",light:"300",normal:"400",medium:"500",semibold:"600",bold:"700",extrabold:"800",black:"900"},gap:eI("spacing"),gradientColorStops:eI("colors"),gridAutoColumns:{auto:"auto",min:"min-content",max:"max-content",fr:"minmax(0,1fr)"},gridAutoRows:{auto:"auto",min:"min-content",max:"max-content",fr:"minmax(0,1fr)"},gridColumn:{auto:"auto","span-full":"1 / -1"},gridRow:{auto:"auto","span-full":"1 / -1"},gridTemplateColumns:{none:"none"},gridTemplateRows:{none:"none"},height:({theme:e})=>({...e("spacing"),...ej(2,6),min:"min-content",max:"max-content",fit:"fit-content",auto:"auto",full:"100%",screen:"100vh"}),inset:({theme:e})=>({...e("spacing"),...ej(2,4),auto:"auto",full:"100%"}),keyframes:{spin:{from:{transform:"rotate(0deg)"},to:{transform:"rotate(360deg)"}},ping:{"0%":{transform:"scale(1)",opacity:"1"},"75%,100%":{transform:"scale(2)",opacity:"0"}},pulse:{"0%,100%":{opacity:"1"},"50%":{opacity:".5"}},bounce:{"0%, 100%":{transform:"translateY(-25%)",animationTimingFunction:"cubic-bezier(0.8,0,1,1)"},"50%":{transform:"none",animationTimingFunction:"cubic-bezier(0,0,0.2,1)"}}},letterSpacing:{tighter:"-0.05em",tight:"-0.025em",normal:"0em",wide:"0.025em",wider:"0.05em",widest:"0.1em"},lineHeight:{...eD(10,"rem",4,3),none:"1",tight:"1.25",snug:"1.375",normal:"1.5",relaxed:"1.625",loose:"2"},margin:({theme:e})=>({auto:"auto",...e("spacing")}),maxHeight:({theme:e})=>({full:"100%",min:"min-content",max:"max-content",fit:"fit-content",screen:"100vh",...e("spacing")}),maxWidth:({theme:e,breakpoints:t})=>({...t(e("screens")),none:"none",0:"0rem",xs:"20rem",sm:"24rem",md:"28rem",lg:"32rem",xl:"36rem","2xl":"42rem","3xl":"48rem","4xl":"56rem","5xl":"64rem","6xl":"72rem","7xl":"80rem",full:"100%",min:"min-content",max:"max-content",fit:"fit-content",prose:"65ch"}),minHeight:{0:"0px",full:"100%",min:"min-content",max:"max-content",fit:"fit-content",screen:"100vh"},minWidth:{0:"0px",full:"100%",min:"min-content",max:"max-content",fit:"fit-content"},opacity:{...eD(100,"",100,0,10),5:"0.05",25:"0.25",75:"0.75",95:"0.95"},order:{first:"-9999",last:"9999",none:"0"},padding:eI("spacing"),placeholderColor:eI("colors"),placeholderOpacity:eI("opacity"),outlineColor:eI("colors"),outlineOffset:eR(8,"px"),outlineWidth:eR(8,"px"),ringColor:({theme:e})=>({...e("colors"),DEFAULT:"#3b82f6"}),ringOffsetColor:eI("colors"),ringOffsetWidth:eR(8,"px"),ringOpacity:({theme:e})=>({...e("opacity"),DEFAULT:"0.5"}),ringWidth:{DEFAULT:"3px",...eR(8,"px")},rotate:{...eR(2,"deg"),...eR(12,"deg",3),...eR(180,"deg",45)},saturate:eD(200,"",100,0,50),scale:{...eD(150,"",100,0,50),...eD(110,"",100,90,5),75:"0.75",125:"1.25"},scrollMargin:eI("spacing"),scrollPadding:eI("spacing"),sepia:{0:"0",DEFAULT:"100%"},skew:{...eR(2,"deg"),...eR(12,"deg",3)},space:eI("spacing"),stroke:({theme:e})=>({...e("colors"),none:"none"}),strokeWidth:eD(2),textColor:eI("colors"),textDecorationColor:eI("colors"),textDecorationThickness:{"from-font":"from-font",auto:"auto",...eR(8,"px")},textUnderlineOffset:{auto:"auto",...eR(8,"px")},textIndent:eI("spacing"),textOpacity:eI("opacity"),transitionDuration:({theme:e})=>({...e("durations"),DEFAULT:"150ms"}),transitionDelay:eI("durations"),transitionProperty:{none:"none",all:"all",DEFAULT:"color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter",colors:"color,background-color,border-color,text-decoration-color,fill,stroke",opacity:"opacity",shadow:"box-shadow",transform:"transform"},transitionTimingFunction:{DEFAULT:"cubic-bezier(0.4,0,0.2,1)",linear:"linear",in:"cubic-bezier(0.4,0,1,1)",out:"cubic-bezier(0,0,0.2,1)","in-out":"cubic-bezier(0.4,0,0.2,1)"},translate:({theme:e})=>({...e("spacing"),...ej(2,4),full:"100%"}),width:({theme:e})=>({min:"min-content",max:"max-content",fit:"fit-content",screen:"100vw",...e("flexBasis")}),willChange:{scroll:"scroll-position"},zIndex:{...eD(50,"",1,0,10),auto:"auto"}};function ej(e,t){let r={};do for(var i=1;i<e;i++)r[`${i}/${e}`]=Number((i/e*100).toFixed(6))+"%";while(++e<=t);return r}function eR(e,t,r=0){let i={};for(;r<=e;r=2*r||1)i[r]=r+t;return i}function eD(e,t="",r=1,i=0,o=1,a={}){for(;i<=e;i+=o)a[i]=i/r+t;return a}function eI(e){return({theme:t})=>t(e)}let eP={"*,::before,::after":{boxSizing:"border-box",borderWidth:"0",borderStyle:"solid",borderColor:"theme(borderColor.DEFAULT, currentColor)"},"::before,::after":{"--tw-content":"''"},html:{lineHeight:1.5,WebkitTextSizeAdjust:"100%",MozTabSize:"4",tabSize:4,fontFamily:`theme(fontFamily.sans, ${eW.fontFamily.sans})`,fontFeatureSettings:"theme(fontFamily.sans[1].fontFeatureSettings, normal)"},body:{margin:"0",lineHeight:"inherit"},hr:{height:"0",color:"inherit",borderTopWidth:"1px"},"abbr:where([title])":{textDecoration:"underline dotted"},"h1,h2,h3,h4,h5,h6":{fontSize:"inherit",fontWeight:"inherit"},a:{color:"inherit",textDecoration:"inherit"},"b,strong":{fontWeight:"bolder"},"code,kbd,samp,pre":{fontFamily:`theme(fontFamily.mono, ${eW.fontFamily.mono})`,fontFeatureSettings:"theme(fontFamily.mono[1].fontFeatureSettings, normal)",fontSize:"1em"},small:{fontSize:"80%"},"sub,sup":{fontSize:"75%",lineHeight:0,position:"relative",verticalAlign:"baseline"},sub:{bottom:"-0.25em"},sup:{top:"-0.5em"},table:{textIndent:"0",borderColor:"inherit",borderCollapse:"collapse"},"button,input,optgroup,select,textarea":{fontFamily:"inherit",fontSize:"100%",lineHeight:"inherit",color:"inherit",margin:"0",padding:"0"},"button,select":{textTransform:"none"},"button,[type='button'],[type='reset'],[type='submit']":{WebkitAppearance:"button",backgroundColor:"transparent",backgroundImage:"none"},":-moz-focusring":{outline:"auto"},":-moz-ui-invalid":{boxShadow:"none"},progress:{verticalAlign:"baseline"},"::-webkit-inner-spin-button,::-webkit-outer-spin-button":{height:"auto"},"[type='search']":{WebkitAppearance:"textfield",outlineOffset:"-2px"},"::-webkit-search-decoration":{WebkitAppearance:"none"},"::-webkit-file-upload-button":{WebkitAppearance:"button",font:"inherit"},summary:{display:"list-item"},"blockquote,dl,dd,h1,h2,h3,h4,h5,h6,hr,figure,p,pre":{margin:"0"},fieldset:{margin:"0",padding:"0"},legend:{padding:"0"},"ol,ul,menu":{listStyle:"none",margin:"0",padding:"0"},textarea:{resize:"vertical"},"input::placeholder,textarea::placeholder":{opacity:1,color:"theme(colors.gray.400, #9ca3af)"},'button,[role="button"]':{cursor:"pointer"},":disabled":{cursor:"default"},"img,svg,video,canvas,audio,iframe,embed,object":{display:"block",verticalAlign:"middle"},"img,video":{maxWidth:"100%",height:"auto"},"[hidden]":{display:"none"}},eV=[ep("\\[([-\\w]+):(.+)]",({1:e,2:t},r)=>({"@layer overrides":{"&":{[e]:ew(`[${t}]`,"",r)}}})),ep("(group|peer)([~/][^-[]+)?",({input:e},{h:t})=>[{c:t(e)}]),em("aspect-","aspectRatio"),ep("container",(e,{theme:t})=>{let{screens:r=t("screens"),center:i,padding:o}=t("container"),a={width:"100%",marginRight:i&&"auto",marginLeft:i&&"auto",...n("xs")};for(let e in r){let t=r[e];"string"==typeof t&&(a[E(t)]={"&":{maxWidth:t,...n(e)}})}return a;function n(e){let t=o&&("string"==typeof o?o:o[e]||o.DEFAULT);if(t)return{paddingRight:t,paddingLeft:t}}}),em("content-","content",({_:e})=>({"--tw-content":e,content:"var(--tw-content)"})),ep("(?:box-)?decoration-(slice|clone)","boxDecorationBreak"),ep("box-(border|content)","boxSizing",({1:e})=>e+"-box"),ep("hidden",{display:"none"}),ep("table-(auto|fixed)","tableLayout"),ep(["(block|flex|table|grid|inline|contents|flow-root|list-item)","(inline-(block|flex|table|grid))","(table-(caption|cell|column|row|(column|row|footer|header)-group))"],"display"),"(float)-(left|right|none)","(clear)-(left|right|none|both)","(overflow(?:-[xy])?)-(auto|hidden|clip|visible|scroll)","(isolation)-(auto)",ep("isolate","isolation"),ep("object-(contain|cover|fill|none|scale-down)","objectFit"),em("object-","objectPosition"),ep("object-(top|bottom|center|(left|right)(-(top|bottom))?)","objectPosition",eH),ep("overscroll(-[xy])?-(auto|contain|none)",({1:e="",2:t})=>({["overscroll-behavior"+e]:t})),ep("(static|fixed|absolute|relative|sticky)","position"),em("-?inset(-[xy])?(?:$|-)","inset",({1:e,_:t})=>({top:"-x"!=e&&t,right:"-y"!=e&&t,bottom:"-x"!=e&&t,left:"-y"!=e&&t})),em("-?(top|bottom|left|right)(?:$|-)","inset"),ep("(visible|collapse)","visibility"),ep("invisible",{visibility:"hidden"}),em("-?z-","zIndex"),ep("flex-((row|col)(-reverse)?)","flexDirection",eN),ep("flex-(wrap|wrap-reverse|nowrap)","flexWrap"),em("(flex-(?:grow|shrink))(?:$|-)"),em("(flex)-"),em("grow(?:$|-)","flexGrow"),em("shrink(?:$|-)","flexShrink"),em("basis-","flexBasis"),em("-?(order)-"),"-?(order)-(\\d+)",em("grid-cols-","gridTemplateColumns"),ep("grid-cols-(\\d+)","gridTemplateColumns",eK),em("col-","gridColumn"),ep("col-(span)-(\\d+)","gridColumn",eX),em("col-start-","gridColumnStart"),ep("col-start-(auto|\\d+)","gridColumnStart"),em("col-end-","gridColumnEnd"),ep("col-end-(auto|\\d+)","gridColumnEnd"),em("grid-rows-","gridTemplateRows"),ep("grid-rows-(\\d+)","gridTemplateRows",eK),em("row-","gridRow"),ep("row-(span)-(\\d+)","gridRow",eX),em("row-start-","gridRowStart"),ep("row-start-(auto|\\d+)","gridRowStart"),em("row-end-","gridRowEnd"),ep("row-end-(auto|\\d+)","gridRowEnd"),ep("grid-flow-((row|col)(-dense)?)","gridAutoFlow",e=>eH(eN(e))),ep("grid-flow-(dense)","gridAutoFlow"),em("auto-cols-","gridAutoColumns"),em("auto-rows-","gridAutoRows"),em("gap-x(?:$|-)","gap","columnGap"),em("gap-y(?:$|-)","gap","rowGap"),em("gap(?:$|-)","gap"),"(justify-(?:items|self))-",ep("justify-","justifyContent",eB),ep("(content|items|self)-",e=>({["align-"+e[1]]:eB(e)})),ep("(place-(content|items|self))-",({1:e,$$:t})=>({[e]:("wun".includes(t[3])?"space-":"")+t})),em("p([xytrbl])?(?:$|-)","padding",eZ("padding")),em("-?m([xytrbl])?(?:$|-)","margin",eZ("margin")),em("-?space-(x|y)(?:$|-)","space",({1:e,_:t})=>({"&>:not([hidden])~:not([hidden])":{[`--tw-space-${e}-reverse`]:"0",["margin-"+({y:"top",x:"left"})[e]]:`calc(${t} * calc(1 - var(--tw-space-${e}-reverse)))`,["margin-"+({y:"bottom",x:"right"})[e]]:`calc(${t} * var(--tw-space-${e}-reverse))`}})),ep("space-(x|y)-reverse",({1:e})=>({"&>:not([hidden])~:not([hidden])":{[`--tw-space-${e}-reverse`]:"1"}})),em("w-","width"),em("min-w-","minWidth"),em("max-w-","maxWidth"),em("h-","height"),em("min-h-","minHeight"),em("max-h-","maxHeight"),em("font-","fontWeight"),em("font-","fontFamily",({_:e})=>"string"==typeof(e=F(e))[1]?{fontFamily:e_(e)}:{fontFamily:e_(e[0]),...e[1]}),ep("antialiased",{WebkitFontSmoothing:"antialiased",MozOsxFontSmoothing:"grayscale"}),ep("subpixel-antialiased",{WebkitFontSmoothing:"auto",MozOsxFontSmoothing:"auto"}),ep("italic","fontStyle"),ep("not-italic",{fontStyle:"normal"}),ep("(ordinal|slashed-zero|(normal|lining|oldstyle|proportional|tabular)-nums|(diagonal|stacked)-fractions)",({1:e,2:t="",3:r})=>"normal"==t?{fontVariantNumeric:"normal"}:{["--tw-"+(r?"numeric-fraction":"pt".includes(t[0])?"numeric-spacing":t?"numeric-figure":e)]:e,fontVariantNumeric:"var(--tw-ordinal) var(--tw-slashed-zero) var(--tw-numeric-figure) var(--tw-numeric-spacing) var(--tw-numeric-fraction)",...eQ({"--tw-ordinal":"var(--tw-empty,/*!*/ /*!*/)","--tw-slashed-zero":"var(--tw-empty,/*!*/ /*!*/)","--tw-numeric-figure":"var(--tw-empty,/*!*/ /*!*/)","--tw-numeric-spacing":"var(--tw-empty,/*!*/ /*!*/)","--tw-numeric-fraction":"var(--tw-empty,/*!*/ /*!*/)"})}),em("tracking-","letterSpacing"),em("leading-","lineHeight"),ep("list-(inside|outside)","listStylePosition"),em("list-","listStyleType"),ep("list-","listStyleType"),em("placeholder-opacity-","placeholderOpacity",({_:e})=>({"&::placeholder":{"--tw-placeholder-opacity":e}})),eh("placeholder-",{property:"color",selector:"&::placeholder"}),ep("text-(left|center|right|justify|start|end)","textAlign"),ep("text-(ellipsis|clip)","textOverflow"),em("text-opacity-","textOpacity","--tw-text-opacity"),eh("text-",{property:"color"}),em("text-","fontSize",({_:e})=>"string"==typeof e?{fontSize:e}:{fontSize:e[0],..."string"==typeof e[1]?{lineHeight:e[1]}:e[1]}),em("indent-","textIndent"),ep("(overline|underline|line-through)","textDecorationLine"),ep("no-underline",{textDecorationLine:"none"}),em("underline-offset-","textUnderlineOffset"),eh("decoration-",{section:"textDecorationColor",opacityVariable:!1,opacitySection:"opacity"}),em("decoration-","textDecorationThickness"),ep("decoration-","textDecorationStyle"),ep("(uppercase|lowercase|capitalize)","textTransform"),ep("normal-case",{textTransform:"none"}),ep("truncate",{overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}),ep("align-","verticalAlign"),ep("whitespace-","whiteSpace"),ep("break-normal",{wordBreak:"normal",overflowWrap:"normal"}),ep("break-words",{overflowWrap:"break-word"}),ep("break-all",{wordBreak:"break-all"}),ep("break-keep",{wordBreak:"keep-all"}),eh("caret-",{opacityVariable:!1,opacitySection:"opacity"}),eh("accent-",{opacityVariable:!1,opacitySection:"opacity"}),ep("bg-gradient-to-([trbl]|[tb][rl])","backgroundImage",({1:e})=>`linear-gradient(to ${eU(e," ")},var(--tw-gradient-stops))`),eh("from-",{section:"gradientColorStops",opacityVariable:!1,opacitySection:"opacity"},({_:e})=>({"--tw-gradient-from":e.value,"--tw-gradient-to":e.color({opacityValue:"0"}),"--tw-gradient-stops":"var(--tw-gradient-from),var(--tw-gradient-to)"})),eh("via-",{section:"gradientColorStops",opacityVariable:!1,opacitySection:"opacity"},({_:e})=>({"--tw-gradient-to":e.color({opacityValue:"0"}),"--tw-gradient-stops":`var(--tw-gradient-from),${e.value},var(--tw-gradient-to)`})),eh("to-",{section:"gradientColorStops",property:"--tw-gradient-to",opacityVariable:!1,opacitySection:"opacity"}),ep("bg-(fixed|local|scroll)","backgroundAttachment"),ep("bg-origin-(border|padding|content)","backgroundOrigin",({1:e})=>e+"-box"),ep(["bg-(no-repeat|repeat(-[xy])?)","bg-repeat-(round|space)"],"backgroundRepeat"),ep("bg-blend-","backgroundBlendMode"),ep("bg-clip-(border|padding|content|text)","backgroundClip",({1:e})=>e+("text"==e?"":"-box")),em("bg-opacity-","backgroundOpacity","--tw-bg-opacity"),eh("bg-",{section:"backgroundColor"}),em("bg-","backgroundImage"),em("bg-","backgroundPosition"),ep("bg-(top|bottom|center|(left|right)(-(top|bottom))?)","backgroundPosition",eH),em("bg-","backgroundSize"),em("rounded(?:$|-)","borderRadius"),em("rounded-([trbl]|[tb][rl])(?:$|-)","borderRadius",({1:e,_:t})=>{let r={t:["tl","tr"],r:["tr","br"],b:["bl","br"],l:["bl","tl"]}[e]||[e,e];return{[`border-${eU(r[0])}-radius`]:t,[`border-${eU(r[1])}-radius`]:t}}),ep("border-(collapse|separate)","borderCollapse"),em("border-opacity(?:$|-)","borderOpacity","--tw-border-opacity"),ep("border-(solid|dashed|dotted|double|none)","borderStyle"),em("border-spacing(-[xy])?(?:$|-)","borderSpacing",({1:e,_:t})=>({...eQ({"--tw-border-spacing-x":"0","--tw-border-spacing-y":"0"}),["--tw-border-spacing"+(e||"-x")]:t,["--tw-border-spacing"+(e||"-y")]:t,"border-spacing":"var(--tw-border-spacing-x) var(--tw-border-spacing-y)"})),eh("border-([xytrbl])-",{section:"borderColor"},eZ("border","Color")),eh("border-"),em("border-([xytrbl])(?:$|-)","borderWidth",eZ("border","Width")),em("border(?:$|-)","borderWidth"),em("divide-opacity(?:$|-)","divideOpacity",({_:e})=>({"&>:not([hidden])~:not([hidden])":{"--tw-divide-opacity":e}})),ep("divide-(solid|dashed|dotted|double|none)",({1:e})=>({"&>:not([hidden])~:not([hidden])":{borderStyle:e}})),ep("divide-([xy]-reverse)",({1:e})=>({"&>:not([hidden])~:not([hidden])":{["--tw-divide-"+e]:"1"}})),em("divide-([xy])(?:$|-)","divideWidth",({1:e,_:t})=>{let r={x:"lr",y:"tb"}[e];return{"&>:not([hidden])~:not([hidden])":{[`--tw-divide-${e}-reverse`]:"0",[`border-${eU(r[0])}Width`]:`calc(${t} * calc(1 - var(--tw-divide-${e}-reverse)))`,[`border-${eU(r[1])}Width`]:`calc(${t} * var(--tw-divide-${e}-reverse))`}}}),eh("divide-",{property:"borderColor",selector:"&>:not([hidden])~:not([hidden])"}),em("ring-opacity(?:$|-)","ringOpacity","--tw-ring-opacity"),eh("ring-offset-",{property:"--tw-ring-offset-color",opacityVariable:!1}),em("ring-offset(?:$|-)","ringOffsetWidth","--tw-ring-offset-width"),ep("ring-inset",{"--tw-ring-inset":"inset"}),eh("ring-",{property:"--tw-ring-color"}),em("ring(?:$|-)","ringWidth",({_:e},{theme:t})=>({...eQ({"--tw-ring-offset-shadow":"0 0 #0000","--tw-ring-shadow":"0 0 #0000","--tw-shadow":"0 0 #0000","--tw-shadow-colored":"0 0 #0000","&":{"--tw-ring-inset":"var(--tw-empty,/*!*/ /*!*/)","--tw-ring-offset-width":t("ringOffsetWidth","","0px"),"--tw-ring-offset-color":G(t("ringOffsetColor","","#fff")),"--tw-ring-color":G(t("ringColor","","#93c5fd"),{opacityVariable:"--tw-ring-opacity"}),"--tw-ring-opacity":t("ringOpacity","","0.5")}}),"--tw-ring-offset-shadow":"var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)","--tw-ring-shadow":`var(--tw-ring-inset) 0 0 0 calc(${e} + var(--tw-ring-offset-width)) var(--tw-ring-color)`,boxShadow:"var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)"})),eh("shadow-",{section:"boxShadowColor",opacityVariable:!1,opacitySection:"opacity"},({_:e})=>({"--tw-shadow-color":e.value,"--tw-shadow":"var(--tw-shadow-colored)"})),em("shadow(?:$|-)","boxShadow",({_:e})=>({...eQ({"--tw-ring-offset-shadow":"0 0 #0000","--tw-ring-shadow":"0 0 #0000","--tw-shadow":"0 0 #0000","--tw-shadow-colored":"0 0 #0000"}),"--tw-shadow":e_(e),"--tw-shadow-colored":e_(e).replace(/([^,]\s+)(?:#[a-f\d]+|(?:(?:hsl|rgb)a?|hwb|lab|lch|color|var)\(.+?\)|[a-z]+)(,|$)/g,"$1var(--tw-shadow-color)$2"),boxShadow:"var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)"})),em("(opacity)-"),ep("mix-blend-","mixBlendMode"),...eJ(),...eJ("backdrop-"),em("transition(?:$|-)","transitionProperty",(e,{theme:t})=>({transitionProperty:e_(e),transitionTimingFunction:"none"==e._?void 0:e_(t("transitionTimingFunction","")),transitionDuration:"none"==e._?void 0:e_(t("transitionDuration",""))})),em("duration(?:$|-)","transitionDuration","transitionDuration",e_),em("ease(?:$|-)","transitionTimingFunction","transitionTimingFunction",e_),em("delay(?:$|-)","transitionDelay","transitionDelay",e_),em("animate(?:$|-)","animation",(e,{theme:t,h:r,e:i})=>{let o=e_(e),a=o.split(" "),n=t("keyframes",a[0]);return n?{["@keyframes "+(a[0]=i(r(a[0])))]:n,animation:a.join(" ")}:{animation:o}}),"(transform)-(none)",ep("transform",eG),ep("transform-(cpu|gpu)",({1:e})=>({"--tw-transform":eY("gpu"==e)})),em("scale(-[xy])?-","scale",({1:e,_:t})=>({["--tw-scale"+(e||"-x")]:t,["--tw-scale"+(e||"-y")]:t,...eG()})),em("-?(rotate)-","rotate",eq),em("-?(translate-[xy])-","translate",eq),em("-?(skew-[xy])-","skew",eq),ep("origin-(center|((top|bottom)(-(left|right))?)|left|right)","transformOrigin",eH),"(appearance)-",em("(columns)-"),"(columns)-(\\d+)","(break-(?:before|after|inside))-",em("(cursor)-"),"(cursor)-",ep("snap-(none)","scroll-snap-type"),ep("snap-(x|y|both)",({1:e})=>({...eQ({"--tw-scroll-snap-strictness":"proximity"}),"scroll-snap-type":e+" var(--tw-scroll-snap-strictness)"})),ep("snap-(mandatory|proximity)","--tw-scroll-snap-strictness"),ep("snap-(?:(start|end|center)|align-(none))","scroll-snap-align"),ep("snap-(normal|always)","scroll-snap-stop"),ep("scroll-(auto|smooth)","scroll-behavior"),em("scroll-p([xytrbl])?(?:$|-)","padding",eZ("scroll-padding")),em("-?scroll-m([xytrbl])?(?:$|-)","scroll-margin",eZ("scroll-margin")),ep("touch-(auto|none|manipulation)","touch-action"),ep("touch-(pinch-zoom|pan-(?:(x|left|right)|(y|up|down)))",({1:e,2:t,3:r})=>({...eQ({"--tw-pan-x":"var(--tw-empty,/*!*/ /*!*/)","--tw-pan-y":"var(--tw-empty,/*!*/ /*!*/)","--tw-pinch-zoom":"var(--tw-empty,/*!*/ /*!*/)","--tw-touch-action":"var(--tw-pan-x) var(--tw-pan-y) var(--tw-pinch-zoom)"}),[`--tw-${t?"pan-x":r?"pan-y":e}`]:e,"touch-action":"var(--tw-touch-action)"})),ep("outline-none",{outline:"2px solid transparent","outline-offset":"2px"}),ep("outline",{outlineStyle:"solid"}),ep("outline-(dashed|dotted|double)","outlineStyle"),em("-?(outline-offset)-"),eh("outline-",{opacityVariable:!1,opacitySection:"opacity"}),em("outline-","outlineWidth"),"(pointer-events)-",em("(will-change)-"),"(will-change)-",["resize(?:-(none|x|y))?","resize",({1:e})=>({x:"horizontal",y:"vertical"})[e]||e||"both"],ep("select-(none|text|all|auto)","userSelect"),eh("fill-",{section:"fill",opacityVariable:!1,opacitySection:"opacity"}),eh("stroke-",{section:"stroke",opacityVariable:!1,opacitySection:"opacity"}),em("stroke-","strokeWidth"),ep("sr-only",{position:"absolute",width:"1px",height:"1px",padding:"0",margin:"-1px",overflow:"hidden",whiteSpace:"nowrap",clip:"rect(0,0,0,0)",borderWidth:"0"}),ep("not-sr-only",{position:"static",width:"auto",height:"auto",padding:"0",margin:"0",overflow:"visible",whiteSpace:"normal",clip:"auto"})];function eH(e){return("string"==typeof e?e:e[1]).replace(/-/g," ").trim()}function eN(e){return("string"==typeof e?e:e[1]).replace("col","column")}function eU(e,t="-"){let r=[];for(let t of e)r.push({t:"top",r:"right",b:"bottom",l:"left"}[t]);return r.join(t)}function e_(e){return e&&""+(e._||e)}function eB({$$:e}){return(({r:"flex-","":"flex-",w:"space-",u:"space-",n:"space-"})[e[3]||""]||"")+e}function eZ(e,t=""){return({1:r,_:i})=>{let o={x:"lr",y:"tb"}[r]||r+r;return o?{...eb(e+"-"+eU(o[0])+t,i),...eb(e+"-"+eU(o[1])+t,i)}:eb(e+t,i)}}function eJ(e=""){let t=["blur","brightness","contrast","grayscale","hue-rotate","invert",e&&"opacity","saturate","sepia",!e&&"drop-shadow"].filter(Boolean),r={};for(let i of t)r[`--tw-${e}${i}`]="var(--tw-empty,/*!*/ /*!*/)";return r={...eQ(r),[`${e}filter`]:t.map(t=>`var(--tw-${e}${t})`).join(" ")},[`(${e}filter)-(none)`,ep(`${e}filter`,r),...t.map(t=>em(`${"h"==t[0]?"-?":""}(${e}${t})(?:$|-)`,t,({1:e,_:i})=>({[`--tw-${e}`]:F(i).map(e=>`${t}(${e})`).join(" "),...r})))]}function eq({1:e,_:t}){return{["--tw-"+e]:t,...eG()}}function eG(){return{...eQ({"--tw-translate-x":"0","--tw-translate-y":"0","--tw-rotate":"0","--tw-skew-x":"0","--tw-skew-y":"0","--tw-scale-x":"1","--tw-scale-y":"1","--tw-transform":eY()}),transform:"var(--tw-transform)"}}function eY(e){return[e?"translate3d(var(--tw-translate-x),var(--tw-translate-y),0)":"translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y))","rotate(var(--tw-rotate))","skewX(var(--tw-skew-x))","skewY(var(--tw-skew-y))","scaleX(var(--tw-scale-x))","scaleY(var(--tw-scale-y))"].join(" ")}function eX({1:e,2:t}){return`${e} ${t} / ${e} ${t}`}function eK({1:e}){return`repeat(${e},minmax(0,1fr))`}function eQ(e){return{"@layer defaults":{"*,::before,::after":e,"::backdrop":e}}}let e0=[["sticky","@supports ((position: -webkit-sticky) or (position:sticky))"],["motion-reduce","@media (prefers-reduced-motion:reduce)"],["motion-safe","@media (prefers-reduced-motion:no-preference)"],["print","@media print"],["(portrait|landscape)",({1:e})=>`@media (orientation:${e})`],["contrast-(more|less)",({1:e})=>`@media (prefers-contrast:${e})`],["(first-(letter|line)|placeholder|backdrop|before|after)",({1:e})=>`&::${e}`],["(marker|selection)",({1:e})=>`& *::${e},&::${e}`],["file","&::file-selector-button"],["(first|last|only)",({1:e})=>`&:${e}-child`],["even","&:nth-child(2n)"],["odd","&:nth-child(odd)"],["open","&[open]"],["(aria|data)-",({1:e,$$:t},r)=>t&&`&[${e}-${r.theme(e,t)||ew(t,"",r)||`${t}="true"`}]`],["((group|peer)(~[^-[]+)?)(-\\[(.+)]|[-[].+?)(\\/.+)?",({2:e,3:t="",4:r,5:i="",6:o=t},{e:a,h:n,v:l})=>{let s=ey(i)||("["==r[0]?r:l(r.slice(1)));return`${(s.includes("&")?s:"&"+s).replace(/&/g,`:merge(.${a(n(e+o))})`)}${"p"==e[0]?"~":" "}&`}],["(ltr|rtl)",({1:e})=>`[dir="${e}"] &`],["supports-",({$$:e},t)=>{if(e&&(e=t.theme("supports",e)||ew(e,"",t)),e)return e.includes(":")||(e+=":var(--tw)"),/^\w*\s*\(/.test(e)||(e=`(${e})`),`@supports ${e.replace(/\b(and|or|not)\b/g," $1 ").trim()}`}],["max-",({$$:e},t)=>{if(e&&(e=t.theme("screens",e)||ew(e,"",t)),"string"==typeof e)return`@media not all and (min-width:${e})`}],["min-",({$$:e},t)=>(e&&(e=ew(e,"",t)),e&&`@media (min-width:${e})`)],[/^\[(.+)]$/,({1:e})=>/[&@]/.test(e)&&ey(e).replace(/[}]+$/,"").split("{")]],e1=function(e,t){let r=ek(e),i=function({theme:e,darkMode:t,darkColor:r=M,variants:i,rules:o,hash:a,stringify:n,ignorelist:l,finalize:s}){let c=new Map,d=new Map,u=new Map,p=new Map,f=eL(l,(e,t)=>t.test(e));i.push(["dark",Array.isArray(t)||"class"==t?`${F(t)[1]||".dark"} &`:"string"==typeof t&&"media"!=t?t:"@media (prefers-color-scheme:dark)"]);let g="function"==typeof a?e=>a(e,z):a?z:O;g!==O&&s.push(e=>({...e,n:e.n&&g(e.n),d:e.d?.replace(/--(tw(?:-[\w-]+)?)\b/g,(e,t)=>"--"+g(t).replace("#",""))}));let m={theme:function({extend:e={},...t}){let r={},i={get colors(){return o("colors")},theme:o,negative:()=>({}),breakpoints(e){let t={};for(let r in e)"string"==typeof e[r]&&(t["screen-"+r]=e[r]);return t}};return o;function o(i,n,l,s){if(i){if({1:i,2:s}=/^(\S+?)(?:\s*\/\s*([^/]+))?$/.exec(i)||[,i],/[.[]/.test(i)){let e=[];i.replace(/\[([^\]]+)\]|([^.[]+)/g,(t,r,i=r)=>e.push(i)),i=e.shift(),l=n,n=e.join("-")}let c=r[i]||Object.assign(Object.assign(r[i]={},a(t,i)),a(e,i));if(null==n)return c;n||(n="DEFAULT");let d=c[n]??n.split("-").reduce((e,t)=>e?.[t],c)??l;return s?G(d,{opacityValue:X(s,o)}):d}let c={};for(let r of[...Object.keys(t),...Object.keys(e)])c[r]=o(r);return c}function a(e,t){let r=e[t];return("function"==typeof r&&(r=r(i)),r&&/color|fill|stroke/i.test(t))?function e(t,r=[]){let i={};for(let o in t){let a=t[o],n=[...r,o];i[n.join("-")]=a,"DEFAULT"==o&&(n=r,i[r.join("-")]=a),"object"==typeof a&&Object.assign(i,e(a,n))}return i}(r):r}}(e),e:T,h:g,s:(e,t)=>n(e,t,m),d:(e,t,i)=>r(e,t,m,i),v:e=>(c.has(e)||c.set(e,e$(e,i,d,eC,m)||"&:"+e),c.get(e)),r(e,t){let r=JSON.stringify([e,t]);return u.has(r)||u.set(r,!f(e,m)&&e$(e,o,p,eS,m,t)),u.get(r)},f:e=>s.reduce((e,t)=>t(e,m),e)};return m}(r),o=new Map,a=[],n=new Set;function l(e){let r=i.f(e),o=V(r);if(o&&!n.has(o)){n.add(o);let r=_(a,e);t.insert(o,r,e),a.splice(r,0,e)}return r.n}return t.resume(e=>o.set(e,e),(e,r)=>{t.insert(e,a.length,r),a.push(r),n.add(e)}),Object.defineProperties(function(e){if(!o.size)for(let e of F(r.preflight))"function"==typeof e&&(e=e(i)),e&&("string"==typeof e?ee("",W.b,eo(e),i,W.b,[],!1,!0):Y(e,{},i,W.b)).forEach(l);e=""+e;let t=o.get(e);if(!t){let r=new Set;for(let t of Q(eo(e),i))r.add(t.c).add(l(t));t=[...r].filter(Boolean).join(" "),o.set(e,t).set(t,t)}return t},Object.getOwnPropertyDescriptors({get target(){return t.target},theme:i.theme,config:r,snapshot(){let e=t.snapshot(),r=new Set(n),i=new Map(o),l=[...a];return()=>{e(),n=r,o=i,a=l}},clear(){t.clear(),n=new Set,o=new Map,a=[]},destroy(){this.clear(),t.destroy()}}))}(ek({preflight:!1,hash:!0,darkMode:"class",theme:{extend:{colors:{background:"var(--swk-background)","background-secondary":"var(--swk-background-secondary)","foreground-strong":"var(--swk-foreground-strong)",foreground:"var(--swk-foreground)","foreground-secondary":"var(--swk-foreground-secondary)",primary:"var(--swk-primary)","primary-foreground":"var(--swk-primary-foreground)",transparent:"var(--swk-transparent)",lighter:"var(--swk-lighter)",light:"var(--swk-light)","light-gray":"var(--swk-light-gray)",gray:"var(--swk-gray)",danger:"var(--swk-danger)",border:"var(--swk-border)"},boxShadow:{default:"0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)"},borderRadius:{default:"var(--swk-border-radius)"},fontFamily:{default:"var(--swk-font-family)"}}},presets:[({stringify:e})=>({stringify(t,r,i){var o,a;let n="",l=eO.get(t);l&&(n+=e(l,r,i)+";");let s=(o=/^(?:(text-(?:decoration$|e|or|si)|back(?:ground-cl|d|f)|box-d|mask(?:$|-[ispro]|-cl)|pr|hyphena|flex-d)|(tab-|column(?!-s)|text-align-l)|(ap)|u|hy)/i.exec(t))?o[1]?1:o[2]?2:o[3]?3:5:0,c=(a=/^(?:(pos)|(cli)|(background-i)|(flex(?:$|-b)|(?:max-|min-)?(?:block-s|inl|he|widt))|dis)/i.exec(t))?a[1]?/^sti/i.test(r)?1:0:a[2]?/^pat/i.test(r)?1:0:a[3]?/^image-/i.test(r)?1:0:a[4]?"-"===r[3]?2:0:/^(?:inline-)?grid$/i.test(r)?4:0:0;for(let o of eM)s&o[1]&&(n+=e(o[0]+t,r,i)+";"),c&o[1]&&(n+=e(t,o[0]+r,i)+";");return n+e(t,r,i)}}),function({colors:e,disablePreflight:t}={}){return{preflight:t?void 0:eP,theme:{...eW,colors:{inherit:"inherit",current:"currentColor",transparent:"transparent",black:"#000",white:"#fff",...e}},variants:e0,rules:eV,finalize:e=>e.n&&e.d&&e.r.some(e=>/^&::(before|after)$/.test(e))&&!/(^|;)content:/.test(e.d)?{...e,d:"content:var(--tw-content);"+e.d}:e}}({disablePreflight:!0})]}),"undefined"==typeof document?{target:o=[],snapshot(){let e=[...o];return()=>{o.splice(0,o.length,...e)}},clear(){o.length=0},destroy(){this.clear()},insert(e,t,r){o.splice(t,0,e)},resume:M}:(l="style[data-library]",{target:n=l?.cssRules?l:(l&&"string"!=typeof l?l:((a=document.querySelector(l||'style[data-twind=""]'))&&"STYLE"==a.tagName||(a=document.createElement("style"),document.head.prepend(a)),a.dataset.twind="claimed",a)).sheet,snapshot(){let e=Array.from(n.cssRules,e=>e.cssText);return()=>{this.clear(),e.forEach(this.insert)}},clear(){for(let e=n.cssRules.length;e--;)n.deleteRule(e)},destroy(){n.ownerNode?.remove()},insert(e,t){try{n.insertRule(e,t)}catch(e){n.insertRule(":root{}",t)}},resume:M})),e2=e=>e1(`!(${e})`);(function(e,...t){return("function"==typeof this?this:ez)(en(e,t))}).bind(e1),(function(e,...t){("function"==typeof this?this:ez)(eu({"@layer base":es(e,t)}))}).bind(e1),eE.bind(e1);let e5=eu`
  .stellar-wallets-kit *,
  .stellar-wallets-kit ::after,
  .stellar-wallets-kit ::before,
  .stellar-wallets-kit ::backdrop,
  .stellar-wallets-kit ::file-selector-button {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0 solid;
  }
  .stellar-wallets-kit :host {
    line-height: 1.5;
    -webkit-text-size-adjust: 100%;
    tab-size: 4;
    font-family:
      ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol",
      "Noto Color Emoji";
    font-feature-settings: normal;
    font-variation-settings: normal;
    -webkit-tap-highlight-color: transparent;
  }
  .stellar-wallets-kit hr {
    height: 0;
    color: inherit;
    border-top-width: 1px;
  }
  .stellar-wallets-kit abbr:where([title]) {
    -webkit-text-decoration: underline dotted;
    text-decoration: underline dotted;
  }
  .stellar-wallets-kit h1,
  .stellar-wallets-kit h2,
  .stellar-wallets-kit h3,
  .stellar-wallets-kit h4,
  .stellar-wallets-kit h5,
  .stellar-wallets-kit h6 {
    font-size: inherit;
    font-weight: inherit;
  }
  .stellar-wallets-kit a {
    color: inherit;
    -webkit-text-decoration: inherit;
    text-decoration: inherit;
  }
  .stellar-wallets-kit b,
  .stellar-wallets-kit strong {
    font-weight: bolder;
  }
  .stellar-wallets-kit code,
  .stellar-wallets-kit kbd,
  .stellar-wallets-kit samp,
  .stellar-wallets-kit pre {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-feature-settings: normal;
    font-variation-settings: normal;
    font-size: 1em;
  }
  .stellar-wallets-kit small {
    font-size: 80%;
  }
  .stellar-wallets-kit sub,
  .stellar-wallets-kit sup {
    font-size: 75%;
    line-height: 0;
    position: relative;
    vertical-align: baseline;
  }
  .stellar-wallets-kit sub {
    bottom: -0.25em;
  }
  .stellar-wallets-kit sup {
    top: -0.5em;
  }
  .stellar-wallets-kit table {
    text-indent: 0;
    border-color: inherit;
    border-collapse: collapse;
  }
  .stellar-wallets-kit :-moz-focusring {
    outline: auto;
  }
  .stellar-wallets-kit progress {
    vertical-align: baseline;
  }
  .stellar-wallets-kit summary {
    display: list-item;
  }
  .stellar-wallets-kit ol,
  .stellar-wallets-kit ul,
  .stellar-wallets-kit menu {
    list-style: none;
  }
  .stellar-wallets-kit img,
  .stellar-wallets-kit svg,
  .stellar-wallets-kit video,
  .stellar-wallets-kit canvas,
  .stellar-wallets-kit audio,
  .stellar-wallets-kit iframe,
  .stellar-wallets-kit embed,
  .stellar-wallets-kit object {
    display: block;
    vertical-align: middle;
  }
  .stellar-wallets-kit img,
  .stellar-wallets-kit video {
    max-width: 100%;
    height: auto;
  }
  .stellar-wallets-kit button,
  .stellar-wallets-kit input,
  .stellar-wallets-kit select,
  .stellar-wallets-kit optgroup,
  .stellar-wallets-kit textarea,
  .stellar-wallets-kit ::file-selector-button {
    font: inherit;
    font-feature-settings: inherit;
    font-variation-settings: inherit;
    letter-spacing: inherit;
    color: inherit;
    border-radius: 0;
    background-color: transparent;
    opacity: 1;
  }
  .stellar-wallets-kit :where(select:is([multiple], [size])) optgroup {
    font-weight: bolder;
  }
  .stellar-wallets-kit :where(select:is([multiple], [size])) optgroup option {
    padding-inline-start: 20px;
  }
  .stellar-wallets-kit ::file-selector-button {
    margin-inline-end: 4px;
  }
  .stellar-wallets-kit ::placeholder {
    opacity: 1;
  }
  .stellar-wallets-kit textarea {
    resize: vertical;
  }
  .stellar-wallets-kit ::-webkit-search-decoration {
    -webkit-appearance: none;
  }
  .stellar-wallets-kit ::-webkit-date-and-time-value {
    min-height: 1lh;
    text-align: inherit;
  }
  .stellar-wallets-kit ::-webkit-datetime-edit {
    display: inline-flex;
  }
  .stellar-wallets-kit ::-webkit-datetime-edit-fields-wrapper {
    padding: 0;
  }
  .stellar-wallets-kit ::-webkit-datetime-edit,
  .stellar-wallets-kit ::-webkit-datetime-edit-year-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-month-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-day-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-hour-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-minute-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-second-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-millisecond-field,
  .stellar-wallets-kit ::-webkit-datetime-edit-meridiem-field {
    padding-block: 0;
  }
  .stellar-wallets-kit ::-webkit-calendar-picker-indicator {
    line-height: 1;
  }
  .stellar-wallets-kit :-moz-ui-invalid {
    box-shadow: none;
  }
  .stellar-wallets-kit button,
  .stellar-wallets-kit input:where([type="button"], [type="reset"], [type="submit"]),
  .stellar-wallets-kit ::file-selector-button {
    appearance: button;
  }
  .stellar-wallets-kit ::-webkit-inner-spin-button,
  .stellar-wallets-kit ::-webkit-outer-spin-button {
    height: auto;
  }
  .stellar-wallets-kit [hidden]:where(:not([hidden="until-found"])) {
    display: none !important;
  }
`;function e9({size:e=p.md,mode:t=f.primary,shape:r=g.regular,classes:i,styles:o,children:a,onClick:n}){let l=ev({"border-none bg-primary text-primary-foreground shadow-default hover:opacity-70 focus:opacity-90":t===f.primary,"border-none bg-background text-foreground shadow-default hover:opacity-70 focus:opacity-90":t===f.secondary,"bg-transparent text-foreground border-transparent border-1 hover:border-light-gray":t===f.ghost}),s=ev({"rounded-default":r===g.regular,"rounded-full":r===g.icon}),c=ev({"text-xs":e===p.xs,"text-sm":e!==p.xs}),d=ev({"px-2 py-1":r===g.regular&&(e===p.xs||e===p.sm),"px-2.5 py-1.5":r===g.regular&&e===p.md,"px-3 py-2":r===g.regular&&e===p.lg,"px-3.5 py-2.5":r===g.regular&&e===p.xl,"p-1":r===g.icon&&e===p.xs,"p-1.5":r===g.icon&&e===p.sm,"p-2":r===g.icon&&e===p.md,"p-2.5":r===g.icon&&e===p.lg,"p-3":r===g.icon&&e===p.xl}),u=t===f.free?"":e2(ev("cursor-pointer","flex items-center justify-center font-semibold easy-in-out transition leading-none",l,s,c,d));return y`
    <button onClick="${()=>n()}" type="button" style="${o}" class="${u} ${i}">
      ${a}
    </button>
  `}(s=p||(p={})).xs="xs",s.sm="sm",s.md="md",s.lg="lg",s.xl="xl",(c=f||(f={})).primary="primary",c.secondary="secondary",c.ghost="ghost",c.free="free",(d=g||(g={})).regular="regular",d.icon="icon";var e4=r(9799);function e3(){k.tx.value=[]}function e8(e){k.BC.value=e,k.tx.value=[...k.tx.value,e]}function e7({children:e,isActive:t,duration:r=300}){let[i,o]=(0,e4.eJ)(t),[a,n]=(0,e4.eJ)(t);if((0,e4.d4)(()=>{if(t)n(!0),globalThis.requestAnimationFrame(()=>o(!0));else{o(!1);let e=globalThis.setTimeout(()=>n(!1),r);return()=>globalThis.clearTimeout(e)}},[t,r]),!a)return null;let l={position:i?"relative":"absolute",inset:0,transition:`opacity ${r}ms ease, transform ${r}ms ease, position ${r}ms ease`,opacity:i?1:0};return y`<div style=${l}>${e}</div>`}function e6({currentRoute:e,pages:t,duration:r=300}){let i=Object.entries(t).map(([t,i])=>y`
      <${e7} id=${t} key=${t} isActive=${e===t} duration=${r}>
        <${i} />
      <//>
    `);return y`<div style=${{position:"relative",width:"100%",height:"100%"}}>${i}</div>`}let te=(0,h.Fl)(()=>k.BC.value===v.dq.AUTH_OPTIONS?y`
      <${e9} onClick=${()=>void e8(v.dq.HELP_PAGE)}
                 size="${p.md}"
                 mode="${f.ghost}"
                 shape="${g.icon}">
        <svg class="${e2("w-4 h-4")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM11 15H13V17H11V15ZM13 13.3551V14H11V12.5C11 11.9477 11.4477 11.5 12 11.5C12.8284 11.5 13.5 10.8284 13.5 10C13.5 9.17157 12.8284 8.5 12 8.5C11.2723 8.5 10.6656 9.01823 10.5288 9.70577L8.56731 9.31346C8.88637 7.70919 10.302 6.5 12 6.5C13.933 6.5 15.5 8.067 15.5 10C15.5 11.5855 14.4457 12.9248 13 13.3551Z"></path></svg>
      <//>
    `:k.tx.value.length<2?y``:y`
      <${e9} onClick=${()=>void!function(){let e=k.tx.value;e.pop(),k.tx.value=e.slice(),k.BC.value=e[e.length-1]}()}
                 size="${p.md}"
                 mode="${f.ghost}"
                 shape="${g.icon}">
        
        <svg class="${e2("w-4 h-4")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7.82843 10.9999H20V12.9999H7.82843L13.1924 18.3638L11.7782 19.778L4 11.9999L11.7782 4.22168L13.1924 5.63589L7.82843 10.9999Z"></path></svg>
      <//>
    `);function tt(){return y`
    <header class="${e2("flex items-center px-3 py-2")}">
      <div class="${e2("w-3/12 flex justify-start")}">
        ${te.value}
      </div>

      <div class="${e2("w-6/12 text-center")}">
        <h1 class="${e2("text-foreground-strong font-semibold")}">
          ${k.d$.value}
        </h1>
      </div>

      <div class="${e2("w-3/12 flex justify-end")}">
        <${e9} onClick=${()=>$.Nv.next()}
                   size="${p.md}"
                   mode="${f.ghost}"
                   shape="${g.icon}">

          <svg class="${e2("w-4 h-4")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"></path></svg>
        <//>
      </div>
    </header>
  `}function tr(){return y`
    <footer class="${e2("w-full text-center p-2 border-t-1 border-t-border")}">
      <p class="${e2("text-xs text-foreground")}">
        Powered by
        <a target="_blank" href="https://stellarwalletskit.dev/" class="${e2("font-semibold underline ml-1")}">
          Stellar Wallets Kit
        </a>
      </p>
    </footer>
  `}function ti(e){return y`
    <img alt="${e.alt}" src="${e.image}" class="${e2(ev("inline-block rounded-full outline -outline-offset-1 outline-black/5 dark:outline-white/10",e.size))}" />
  `}(u=m||(m={})).xs="w-6 h-6",u.sm="w-8 h-8",u.md="w-10 h-10",u.lg="w-12 h-12",u.xl="w-14 h-14";let to=(0,h.Fl)(()=>{let e;let t=k.oO.value.reduce((e,t)=>({available:t.isAvailable?[...e.available,t]:e.available,unavailable:t.isAvailable?e.unavailable:[...e.unavailable,t]}),{available:[],unavailable:[]});try{let t=globalThis?.localStorage.getItem(v.dR.usedWalletsIds);e=t?JSON.parse(t):[]}catch(t){console.error(t),e=[]}let r=[],i=[];for(let o of t.available)e.find(e=>e===o.id)?r.push(o):i.push(o);return[...r.sort((t,r)=>e.indexOf(t.id)-e.indexOf(r.id)),...i,...t.unavailable]});async function ta(e){if(!e.isAvailable){globalThis.open(e.url,"_blank");return}if(k.F5.value=e.id,$.et.next(e),e.type===v.PO.HW_WALLET)e8(v.dq.HW_ACCOUNTS_FETCHER);else try{let{address:e}=await k.yZ.value.getAddress();k.Lt.value=e,$.py.next(e)}catch(e){$.py.next(e)}}var tn=r(1390);let tl=(0,h.td)(!1);function ts(){if(!k.Lt.value)throw Error("Text to copy to the clipboard can't be undefined");navigator.clipboard.writeText(k.Lt.value).then(()=>{tl.value=!0,setTimeout(()=>{tl.value=!1},2500)}).catch(e=>console.error(e))}let tc={error:null,loading:!0,accounts:[]};class td extends b.wA{constructor(){super(...arguments),Object.defineProperty(this,"stateSignal",{enumerable:!0,configurable:!0,writable:!0,value:(0,h.td)(tc)})}componentWillMount(){k.d$.value="Wallet Accounts",this.fetchAccounts()}async fetchAccounts(){let e=k.yZ.value;this.stateSignal.value=tc,e.disconnect&&(await e.disconnect(),await new Promise(e=>setTimeout(e,500)));try{let t=await e.getAddresses();this.stateSignal.value={...this.stateSignal.value,loading:!1,accounts:t}}catch(e){this.stateSignal.value={...this.stateSignal.value,error:e.message}}}async selectAccount(e){k.Lt.value=e.publicKey,$.py.next(e.publicKey)}render(){let e=y`
      <div class="${e2("py-8 w-full flex justify-center items-center text-foreground")}">
        <svg class="${e2("w-8 h-8 text-gray-200 animate-spin")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3C16.9706 3 21 7.02944 21 12H19C19 8.13401 15.866 5 12 5V3Z"></path>
        </svg>
      </div>
    `,t=y`    
      <ul class="${e2("w-full grid gap-2 px-2 py-4 text-foreground")}">
        ${k.ei.value.map(({publicKey:e,index:t})=>y`
            <li onClick=${()=>this.selectAccount({publicKey:e,index:t})}
                class="${e2("px-2 py-2 cursor-pointer flex justify-between items-center bg-background hover:border-light-gray border-1 border-transparent rounded-default duration-150 ease active:bg-background active:border-gray")}">
              ${e.slice(0,6)}....${e.slice(-6)}

              <span class="dialog-text">(44'/148'/${t}')</span>
            </li>
          `)}
      </ul>
    `,r=y`
      <div class="${e2("w-full text-center text-foreground py-4")}">
        <div class="${e2("text-danger")}">
          <svg class="${e2("inline-block mx-auto w-8 h-8 mb-2")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.8659 3.00017L22.3922 19.5002C22.6684 19.9785 22.5045 20.5901 22.0262 20.8662C21.8742 20.954 21.7017 21.0002 21.5262 21.0002H2.47363C1.92135 21.0002 1.47363 20.5525 1.47363 20.0002C1.47363 19.8246 1.51984 19.6522 1.60761 19.5002L11.1339 3.00017C11.41 2.52187 12.0216 2.358 12.4999 2.63414C12.6519 2.72191 12.7782 2.84815 12.8659 3.00017ZM4.20568 19.0002H19.7941L11.9999 5.50017L4.20568 19.0002ZM10.9999 16.0002H12.9999V18.0002H10.9999V16.0002ZM10.9999 9.00017H12.9999V14.0002H10.9999V9.00017Z"></path>
          </svg>
        </div>
        
        <h3 class="${e2("text-sm font-semibold")}">
          Error while fetching accounts with reason:
        </h3>
        
        <p class="${e2("mb-4 text-sm")}">
          ${this.stateSignal.value.error}
        </p>
        
        <div class="${e2("w-full flex justify-center items-center")}">
          <${e9} onClick=${()=>this.fetchAccounts()} size="${p.md}">
            Retry
          <//>
        </div>
      </div>
    `;return this.stateSignal.value.error?r:this.stateSignal.value.loading?e:t}}let tu={[v.dq.AUTH_OPTIONS]:function(){k.d$.value="Connect Wallet";let e=to.value.find(e=>e.isPlatformWrapper);if(e)return ta(e).then(),y`
      <div class="${e2("w-full text-center px-4 py-8")}">
        <div class="${e2("w-full mb-4")}">
          <${ti} alt="${e.name} icon" image="${e.icon}" size="${m.md}" />
        </div>

        <p class="${e2("text-foreground text-lg w-full")}">
          Connecting to your wallet using <b>${e.name}</b>
        </p>
      </div>
    `;let t=y`
    <div class="${e2("w-full text-center text-foreground font-semibold p-4")}">Loading wallets...</div>
  `,r=to.value.map(e=>y`
      <li
        onClick="${()=>ta(e)}"
        class="${e2("px-2 py-2 cursor-pointer flex justify-between items-center bg-background hover:border-light-gray border-1 border-transparent rounded-default duration-150 ease active:bg-background active:border-gray")}"
      >
        <div class="${e2("flex items-center gap-2")}">
          <${ti} class="${e2("mr-2")}" alt="${e.name} icon" image="${e.icon}" size="${m.sm}" />
          <p class="${e2("text-foreground font-semibold")}">${e.name}</p>
        </div>

        ${k.Xk.value&&!e.isAvailable?y`
            <div class="${e2("ml-4 flex items-center")}">
              <small
                class="${e2("inline-flex items-center border-1 border-border px-2 py-1 rounded-default text-foreground-secondary text-xs bg-background-secondary")}"
              >
                ${k.AL.value}

                <svg class="${e2("w-4 h-4")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.0037 9.41421L7.39712 18.0208L5.98291 16.6066L14.5895 8H7.00373V6H18.0037V17H16.0037V9.41421Z"></path>
                </svg>
              </small>
            </div>
          `:""}
      </li>
    `);return y`
    <ul class="${e2("w-full grid gap-2 px-2 py-4")}">
      ${0===to.value.length?t:r}
    </ul>
  `},[v.dq.HELP_PAGE]:function(){return y`
    <section class="${e2("w-full p-4 pb-8 rounded-tl-default")}">
      <div class="${e2("w-full mb-6")}">
        <h3 class="${e2("text-foreground-strong font-semibold text-lg mb-2")}">What is a wallet?</h3>
        <p class="${e2("text-foreground text-sm")}">
          Wallets are used to send, receive, and store the keys you use to sign blockchain transactions.
        </p>
      </div>

      <div class="w-full">
        <h3 class="${e2("text-foreground-strong font-semibold text-lg mb-2")}">What is Stellar?</h3>
        <p class="${e2("text-foreground text-sm")}">
          Stellar is a decentralized, public blockchain that gives developers the tools to create experiences that are more
          like cash than crypto.
        </p>
      </div>
    </section>
  `},[v.dq.PROFILE_PAGE]:function(){return k.d$.value="",y`
    <section class="${e2("w-full flex flex-col pb-8")}">
      <div class="${e2("w-full flex justify-center mb-4")}">
        <${ti} alt="${k.yZ.value?.productName} icon" image="${k.yZ.value?.productIcon}" size="${m.xl}" />
      </div>
      
      <div class="${e2("w-full flex items-center justify-center mb-2")}">
        <h1 class="${e2("text-lg font-semibold text-foreground")}">
          ${k.Lt.value&&`${k.Lt.value.slice(0,6)}....${k.Lt.value.slice(-6)}`}
        </h1>
      </div>
      
      <div class="${e2("w-full flex flex-col items-center justify-center gap-2")}">
        <${e9} mode="${f.ghost}" onClick="${ts}" size="${p.sm}">
          ${tl.value?"Address copied!":y`Copy address`} <svg class="${e2("w-4 h-4 ml-2")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6.9998 6V3C6.9998 2.44772 7.44752 2 7.9998 2H19.9998C20.5521 2 20.9998 2.44772 20.9998 3V17C20.9998 17.5523 20.5521 18 19.9998 18H16.9998V20.9991C16.9998 21.5519 16.5499 22 15.993 22H4.00666C3.45059 22 3 21.5554 3 20.9991L3.0026 7.00087C3.0027 6.44811 3.45264 6 4.00942 6H6.9998ZM5.00242 8L5.00019 20H14.9998V8H5.00242ZM8.9998 6H16.9998V16H18.9998V4H8.9998V6Z"></path></svg>
        <//>

        <${e9} mode="${f.ghost}" onClick="${tn.z}" size="${p.sm}">
          Disconnect <svg class="${e2("w-4 h-4 ml-2")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 11H13V13H5V16L0 12L5 8V11ZM3.99927 18H6.70835C8.11862 19.2447 9.97111 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C9.97111 4 8.11862 4.75527 6.70835 6H3.99927C5.82368 3.57111 8.72836 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C8.72836 22 5.82368 20.4289 3.99927 18Z"></path></svg>
        <//>
      </div>
    </section>
  `},[v.dq.HW_ACCOUNTS_FETCHER]:td},tp=eu`
  .glass {
    backdrop-filter: blur(10px);
    background-color: color-mix(in srgb, var(--swk-background) 25%, transparent);
  }
`;function tf(){let e=e2(ev([k.xJ.value===v.dx.FIXED?"fixed flex left-0 top-0 z-[999] w-full h-full":"inline-flex","font-default justify-center items-center"]));return y`
    <section class="stellar-wallets-kit ${e} ${e2(e5)} ${e2(tp)}">
      ${k.xJ.value===v.dx.FIXED?y`
          <div class="${e2("absolute left-0 top-0 z-0 w-full h-full bg-[rgba(0,0,0,0.5)]")}" onClick="${()=>$.Nv.next()}"></div>
        `:""}

      <section
        class="${e2("w-full h-fit relative max-w-[22rem] max-h-[39.4375rem] grid grid-cols-1 grid-rows-[auto_1fr_auto] bg-background rounded-default shadow-default transition-all duration-[0.5s] ease-in-out overflow-hidden max-h-[400px] overflow-y-scroll")}"
      >
        <div class="${e2("col-span-1 top-0 sticky z-50")} glass">
          <${tt} />
        </div>

        <div class="${e2("col-span-1 relative z-10")}">
          <${e6}
            currentRoute="${k.BC.value}"
            pages="${tu}"
            duration="${400}"
          />
        </div>

        <div class="${e2("col-span-1 bottom-0 sticky z-50")} glass">
          <${tr} />
        </div>
      </section>
    </section>
  `}async function tg(e){if(e&&e(),void 0===k.yF.value)throw Error("The kit hasn't been initiated.");k.yZ.value&&k.Lt.value?await th.profileModal():await th.authModal()}function tm(e){let t=k.Lt.value?`${k.Lt.value.slice(0,4)}....${k.Lt.value.slice(-6)}`:"Connect Wallet";return y`
    <div class="${e2(e5)} ${e2("inline-block")}">      
      <${e9} styles=${e.styles} 
                 classes=${e.classes}
                 mode=${e.mode||f.primary}
                 shape=${e.shape||g.regular}
                 size=${e.size}
                 onClick=${()=>tg(e.onClick)}>        
        ${e.children?e.children:t}
      <//>
    </div>
  `}class th{static init(e){k.yF.value=e.modules,e.selectedWalletId&&th.setWallet(e.selectedWalletId),e.network&&th.setNetwork(e.network),e.theme&&th.setTheme(e.theme),e.authModal&&(void 0!==e.authModal.showInstallLabel&&(k.Xk.value=e.authModal.showInstallLabel),void 0!==e.authModal.hideUnsupportedWallets&&(k.Qb.value=e.authModal.hideUnsupportedWallets))}static get selectedModule(){if(!k.yZ.value)throw{code:-3,message:"Please set the wallet first"};return k.yZ.value}static setWallet(e){let t=k.yF.value.find(t=>t.productId===e);if(!t)throw Error(`Wallet id "${e}" is not and existing module`);k.F5.value=t.productId}static setNetwork(e){k.fr.value=e}static setTheme(e=v.bh){k.rS.value=e}static async getAddress(){if(!k.Lt.value)throw{code:-1,message:"No wallet has been connected."};return{address:k.Lt.value}}static signTransaction(e,t){return th.selectedModule.signTransaction(e,{...t,networkPassphrase:t?.networkPassphrase||k.fr.value})}static signAuthEntry(e,t){return th.selectedModule.signAuthEntry(e,{...t,networkPassphrase:t?.networkPassphrase||k.fr.value})}static signMessage(e,t){return th.selectedModule.signMessage(e,{...t,networkPassphrase:t?.networkPassphrase||k.fr.value})}static getNetwork(){return th.selectedModule.getNetwork()}static async disconnect(){(0,tn.z)()}static on(e,t){switch(e){case v.O9.STATE_UPDATED:{let e,r;return(0,h.cE)(()=>{(k.Lt.value!==e||k.fr.value!==r)&&(e=k.Lt.value,r=k.fr.value,t({eventType:v.O9.STATE_UPDATED,payload:{address:k.Lt.value,networkPassphrase:k.fr.value}}))})}case v.O9.WALLET_SELECTED:{let e;return(0,h.cE)(()=>{k.F5.value!==e&&(e=k.F5.value,t({eventType:v.O9.WALLET_SELECTED,payload:{id:k.F5.value}}))})}case v.O9.DISCONNECT:return $.Fz.subscribe(()=>{t({eventType:v.O9.DISCONNECT,payload:{}})});default:throw Error(`${e} event type is not supported`)}}static async refreshSupportedWallets(){let e=await Promise.all(k.yF.value.map(async e=>{let t=new Promise(e=>setTimeout(()=>e(!1),1e3));return{id:e.productId,name:e.productName,type:e.moduleType,icon:e.productIcon,isAvailable:await Promise.race([t,e.isAvailable()]).catch(()=>!1),isPlatformWrapper:await Promise.race([t,e.isPlatformWrapper?e.isPlatformWrapper():Promise.resolve(!1)]).catch(()=>!1),url:e.productUrl}}));return k.oO.value=e,e}static async createButton(e,t={}){(0,b.sY)(y`
        <${tm}
          styles="${t.styles}"
          classes="${t.classes}"
          mode="${t.mode}"
          shape="${t.shape}"
          size="${t.size}"
          onClick="${()=>t.onClick&&t.onClick()}"
          children="${t.children}"
        />
      `,e)}static async authModal(e){e3(),e8(v.dq.AUTH_OPTIONS),k.xJ.value=e?.container?v.dx.BLOCK:v.dx.FIXED;let t=document.createElement("div");(e?.container||document.body).appendChild(t),(0,b.sY)(y`
        <${tf} />
      `,t),await th.refreshSupportedWallets();let r=[],i=()=>{for(let e of r)e();(0,b.sY)(null,t),t.parentNode?.removeChild(t)};return new Promise((e,t)=>{let i=$.py.subscribe(r=>{"string"==typeof r?e({address:r}):t((0,tn.n)(r))}),o=$.Nv.subscribe(()=>{t({code:-1,message:"The user closed the modal."})});r.push(i),r.push(o)}).then(e=>(i(),e)).catch(e=>{throw i(),e})}static async profileModal(e){if(!k.Lt.value)throw{code:-1,message:"There is no active address, the user needs to authenticate first."};e3(),e8(v.dq.PROFILE_PAGE),k.xJ.value=e?.container?v.dx.BLOCK:v.dx.FIXED;let t=document.createElement("div");(e?.container||document.body).appendChild(t),(0,b.sY)(y`
        <${tf} />
      `,t);let r=$.Nv.subscribe(()=>{r(),(0,b.sY)(null,t),t.parentNode?.removeChild(t)})}}}}]);