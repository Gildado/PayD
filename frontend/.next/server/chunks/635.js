"use strict";exports.id=635,exports.ids=[635],exports.modules={1635:(e,t,r)=>{let i;r.d(t,{Networks:()=>f.pt,StellarWalletsKit:()=>ts});var o,n,a,l,s=r(9904),c=r(2680),d=function(e,t,r,i){var o;t[0]=0;for(var n=1;n<t.length;n++){var a=t[n++],l=t[n]?(t[0]|=a?1:2,r[t[n++]]):t[++n];3===a?i[0]=l:4===a?i[1]=Object.assign(i[1]||{},l):5===a?(i[1]=i[1]||{})[t[++n]]=l:6===a?i[1][t[++n]]+=l+"":a?(o=e.apply(l,d(e,l,r,["",null])),i.push(o),l[0]?t[0]|=2:(t[n-2]=0,t[n]=o)):i.push(l)}return i},u=new Map,p=(function(e){var t=u.get(this);return t||(t=new Map,u.set(this,t)),(t=d(this,t.get(e)||(t.set(e,t=function(e){for(var t,r,i=1,o="",n="",a=[0],l=function(e){1===i&&(e||(o=o.replace(/^\s*\n\s*|\s*\n\s*$/g,"")))?a.push(0,e,o):3===i&&(e||o)?(a.push(3,e,o),i=2):2===i&&"..."===o&&e?a.push(4,e,0):2===i&&o&&!e?a.push(5,0,!0,o):i>=5&&((o||!e&&5===i)&&(a.push(i,0,o,r),i=6),e&&(a.push(i,e,0,r),i=6)),o=""},s=0;s<e.length;s++){s&&(1===i&&l(),l(s));for(var c=0;c<e[s].length;c++)t=e[s][c],1===i?"<"===t?(l(),a=[a],i=3):o+=t:4===i?"--"===o&&">"===t?(i=1,o=""):o=t+o[0]:n?t===n?n="":o+=t:'"'===t||"'"===t?n=t:">"===t?(l(),i=1):i&&("="===t?(i=5,r=o,o=""):"/"===t&&(i<5||">"===e[s][c+1])?(l(),3===i&&(a=a[0]),i=a,(a=a[0]).push(2,0,i),i=0):" "===t||"	"===t||"\n"===t||"\r"===t?(l(),i=2):o+=t),3===i&&"!--"===o&&(i=4,a=a[0])}return l(),a}(e)),t),arguments,[])).length>1?t:t[0]}).bind(c.h),f=r(9240),g=r(3282),m=r(7544);let h=globalThis.localStorage,b=globalThis.document;function w(e){return[...e.v,(e.i?"!":"")+e.n].join(":")}function x(e,t=","){return e.map(w).join(t)}(0,s.cE)(()=>{if(b)for(let[e,t]of Object.entries(g.rS.value))b.documentElement.style.setProperty(`--swk-${e}`,t)}),(0,s.cE)(()=>{if(h&&g.yZ.value)try{let e=h.getItem(f.dR.usedWalletsIds),t=e?new Set(JSON.parse(e)):new Set;t.has(g.yZ.value.productId)&&t.delete(g.yZ.value.productId),h.setItem(f.dR.usedWalletsIds,JSON.stringify([g.yZ.value.productId,...t]))}catch(e){console.error(e)}}),(0,s.cE)(()=>{h&&(g.Lt.value?h.setItem(f.dR.activeAddress,g.Lt.value):h.removeItem(f.dR.activeAddress),g.F5.value?h.setItem(f.dR.selectedModuleId,g.F5.value):h.removeItem(f.dR.selectedModuleId),void 0!==g.ei.value&&h.setItem(f.dR.hardwareWalletPaths,JSON.stringify(g.ei.value)),void 0!==g.NC.value&&h.setItem(f.dR.wcSessionPaths,JSON.stringify(g.NC.value)))});let y="undefined"!=typeof CSS&&CSS.escape||(e=>e.replace(/[!"'`*+.,;:\\/<=>?@#$%&^|~()[\]{}]/g,"\\$&").replace(/^\d/,"\\3$& "));function v(e){for(var t=9,r=e.length;r--;)t=Math.imul(t^e.charCodeAt(r),1597334677);return"#"+((t^t>>>9)>>>0).toString(36)}function k(e,t="@media "){return t+$(e).map(e=>("string"==typeof e&&(e={min:e}),e.raw||Object.keys(e).map(t=>`(${t}-width:${e[t]})`).join(" and "))).join(",")}function $(e=[]){return Array.isArray(e)?e:null==e?[]:[e]}function C(e){return e}function S(){}let A={d:0,b:134217728,c:268435456,a:671088640,u:805306368,o:939524096};function L(e){return e.match(/[-=:;]/g)?.length||0}function T(e){return Math.min(/(?:^|width[^\d]+)(\d+(?:.\d+)?)(p)?/.test(e)?Math.max(0,29.63*(+RegExp.$1/(RegExp.$2?15:1))**.137-43):0,15)<<22|Math.min(L(e),15)<<18}let z=["rst-c","st-ch","h-chi","y-lin","nk","sited","ecked","pty","ad-on","cus-w","ver","cus","cus-v","tive","sable","tiona","quire"];function E({n:e,i:t,v:r=[]},i,o,n){for(let a of(e&&(e=w({n:e,i:t,v:r})),n=[...$(n)],r)){let e=i.theme("screens",a);for(let t of $(e&&k(e)||i.v(a)))n.push(t),o|=e?67108864|T(t):"dark"==a?1073741824:"@"==t[0]?T(t):1<<~(/:([a-z-]+)/.test(t)&&~z.indexOf(RegExp.$1.slice(2,7))||-18)}return{n:e,p:o,r:n,i:t}}let F=new Map;function O(e){if(e.d){let t=[],r=M(e.r.reduce((e,r)=>"@"==r[0]?(t.push(r),e):r?M(e,e=>M(r,t=>{let r=/(:merge\(.+?\))(:[a-z-]+|\\[.+])/.exec(t);if(r){let i=e.indexOf(r[1]);return~i?e.slice(0,i)+r[0]+e.slice(i+r[1].length):W(e,t)}return W(t,e)})):e,"&"),t=>W(t,e.n?"."+y(e.n):""));return r&&t.push(r.replace(/:merge\((.+?)\)/g,"$1")),t.reduceRight((e,t)=>t+"{"+e+"}",e.d)}}function M(e,t){return e.replace(/ *((?:\(.+?\)|\[.+?\]|[^,])+) *(,|$)/g,(e,r,i)=>t(r)+i)}function W(e,t){return e.replace(/&/g,t)}let j=new Intl.Collator("en",{numeric:!0});function R(e,t){for(var r=0,i=e.length;r<i;){let o=i+r>>1;0>=D(e[o],t)?r=o+1:i=o}return i}function D(e,t){let r=e.p&A.o;return r==(t.p&A.o)&&(r==A.b||r==A.o)?0:e.p-t.p||e.o-t.o||j.compare(I(e.n),I(t.n))||j.compare(P(e.n),P(t.n))}function I(e){return(e||"").split(/:/).pop().split("/").pop()||"\0"}function P(e){return(e||"").replace(/\W/g,e=>String.fromCharCode(127+e.charCodeAt(0)))+"\0"}function V(e,t){return Math.round(parseInt(e,16)*t)}function H(e,t={}){if("function"==typeof e)return e(t);let{opacityValue:r="1",opacityVariable:i}=t,o=i?`var(${i})`:r;if(e.includes("<alpha-value>"))return e.replace("<alpha-value>",o);if("#"==e[0]&&(4==e.length||7==e.length)){let t=(e.length-1)/3,r=[17,1,.062272][t-1];return`rgba(${[V(e.substr(1,t),r),V(e.substr(1+t,t),r),V(e.substr(1+2*t,t),r),o]})`}return"1"==o?e:"0"==o?"#0000":e.replace(/^(rgb|hsl)(\([^)]+)\)$/,`$1a$2,${o})`)}function N(e,t,r,i,o=[]){return function e(t,{n:r,p:i,r:o=[],i:n},a){let l=[],s="",c=0,d=0;for(let f in t||{}){var u,p;let g=t[f];if("@"==f[0]){if(!g)continue;if("a"==f[1]){l.push(...Z(r,i,Y(""+g),a,i,o,n,!0));continue}if("l"==f[1]){for(let t of $(g))l.push(...e(t,{n:r,p:(u=A[f[7]],i&~A.o|u),r:"d"==f[7]?[]:o,i:n},a));continue}if("i"==f[1]){l.push(...$(g).map(e=>({p:-1,o:0,r:[],d:f+" "+e})));continue}if("k"==f[1]){l.push({p:A.d,o:0,r:[f],d:e(g,{p:A.d},a).map(O).join("")});continue}if("f"==f[1]){l.push(...$(g).map(t=>({p:A.d,o:0,r:[f],d:e(t,{p:A.d},a).map(O).join("")})));continue}}if("object"!=typeof g||Array.isArray(g))"label"==f&&g?r=g+v(JSON.stringify([i,n,t])):(g||0===g)&&(f=f.replace(/[A-Z]/g,e=>"-"+e.toLowerCase()),d+=1,c=Math.max(c,"-"==(p=f)[0]?0:L(p)+(/^(?:(border-(?!w|c|sty)|[tlbr].{2,4}m?$|c.{7,8}$)|([fl].{5}l|g.{8}$|pl))/.test(p)?+!!RegExp.$1||-!!RegExp.$2:0)+1),s+=(s?";":"")+$(g).map(e=>a.s(f,U(""+e,a.theme)+(n?" !important":""))).join(";"));else if("@"==f[0]||f.includes("&")){let t=i;"@"==f[0]&&(f=f.replace(/\bscreen\(([^)]+)\)/g,(e,r)=>{let i=a.theme("screens",r);return i?(t|=67108864,k(i,"")):e}),t|=T(f)),l.push(...e(g,{n:r,p:t,r:[...o,f],i:n},a))}else l.push(...e(g,{p:i,r:[...o,f]},a))}return l.unshift({n:r,p:i,o:Math.max(0,15-d)+1.5*Math.min(c||15,15),r:o,d:s}),l.sort(D)}(e,E(t,r,i,o),r)}function U(e,t){return e.replace(/theme\((["'`])?(.+?)\1(?:\s*,\s*(["'`])?(.+?)\3)?\)/g,(e,r,i,o,n="")=>{let a=t(i,n);return"function"==typeof a&&/color|fill|stroke/i.test(i)?H(a):""+$(a).filter(e=>Object(e)!==e)})}function B(e,t){let r;let i=[];for(let o of e)o.d&&o.n?r?.p==o.p&&""+r.r==""+o.r?(r.c=[r.c,o.c].filter(Boolean).join(" "),r.d=r.d+";"+o.d):i.push(r={...o,n:o.n&&t}):i.push({...o,n:o.n&&t});return i}function _(e,t,r=A.u,i,o){let n=[];for(let a of e)for(let e of function(e,t,r,i,o){let n=function(e,t){let r=F.get(e.n);return r?r(e,t):t.r(e.n,"dark"==e.v[0])}(e={...e,i:e.i||o},t);return n?"string"==typeof n?({r:i,p:r}=E(e,t,r,i),B(_(Y(n),t,r,i,e.i),e.n)):Array.isArray(n)?n.map(e=>{var t,o;return{o:0,...e,r:[...$(i),...$(e.r)],p:(t=r,o=e.p??r,t&~A.o|o)}}):N(n,e,t,r,i):[{c:w(e),p:0,o:0,r:[]}]}(a,t,r,i,o))n.splice(R(n,e),0,e);return n}function Z(e,t,r,i,o,n,a,l){return B((l?r.flatMap(e=>_([e],i,o,n,a)):_(r,i,o,n,a)).map(e=>e.p&A.o&&(e.n||t==A.b)?{...e,p:e.p&~A.o|t,o:0}:e),e)}function J(e,t,r){if("("!=e[e.length-1]){let r=[],i=!1,o=!1,n="";for(let t of e)if(!("("==t||/[~@]$/.test(t))){if("!"==t[0]&&(t=t.slice(1),i=!i),t.endsWith(":")){r["dark:"==t?"unshift":"push"](t.slice(0,-1));continue}"-"==t[0]&&(t=t.slice(1),o=!o),t.endsWith("-")&&(t=t.slice(0,-1)),t&&"&"!=t&&(n+=(n&&"-")+t)}n&&(o&&(n="-"+n),t[0].push({n:n,v:r.filter(q),i:i}))}}function q(e,t,r){return r.indexOf(e)==t}let G=new Map;function Y(e){let t=G.get(e);if(!t){let r=[],i=[[]],o=0,n=0,a=null,l=0,s=(t,n=0)=>{o!=l&&(r.push(e.slice(o,l+n)),t&&J(r,i)),o=l+1};for(;l<e.length;l++){let t=e[l];if(n)"\\"!=e[l-1]&&(n+=+("["==t)||-("]"==t));else if("["==t)n+=1;else if(a)"\\"!=e[l-1]&&a.test(e.slice(l))&&(a=null,o=l+RegExp.lastMatch.length);else if("/"==t&&"\\"!=e[l-1]&&("*"==e[l+1]||"/"==e[l+1]))a="*"==e[l+1]?/^\*\//:/^[\r\n]/;else if("("==t)s(),r.push(t);else if(":"==t)":"!=e[l+1]&&s(!1,1);else if(/[\s,)]/.test(t)){s(!0);let e=r.lastIndexOf("(");if(")"==t){let t=r[e-1];if(/[~@]$/.test(t)){let o=i.shift();r.length=e,J([...r,"#"],i);let{v:n}=i[0].pop();for(let e of o)e.v.splice(+("dark"==e.v[0])-+("dark"==n[0]),n.length);J([...r,function(e,t,r,i){var o;return o=(e,o)=>{let{n:n,p:a,r:l,i:s}=E(e,o,t);return r&&Z(n,t,r,o,a,l,s,i)},F.set(e,o),e}(t.length>1?t.slice(0,-1)+v(JSON.stringify([t,o])):t+"("+x(o)+")",A.a,o,/@$/.test(t))],i)}e=r.lastIndexOf("(",e-1)}r.length=e+1}else/[~@]/.test(t)&&"("==e[l+1]&&i.unshift([])}s(!0),G.set(e,t=i[0])}return t}function X(e,t,r){return t.reduce((t,i,o)=>t+r(i)+e[o+1],e[0])}function K(e,t){return Array.isArray(e)&&Array.isArray(e.raw)?X(e,t,e=>Q(e).trim()):t.filter(Boolean).reduce((e,t)=>e+Q(t),e?Q(e):"")}function Q(e){let t,r="";if(e&&"object"==typeof e){if(Array.isArray(e))(t=K(e[0],e.slice(1)))&&(r+=" "+t);else for(let t in e)e[t]&&(r+=" "+t)}else null!=e&&"boolean"!=typeof e&&(r+=" "+e);return r}function ee(e,t){return Array.isArray(e)?er(X(e,t,e=>null!=e&&"boolean"!=typeof e?e:"")):"string"==typeof e?er(e):[e]}let et=/ *(?:(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}))/g;function er(e){let t;e=e.replace(/\/\*[^]*?\*\/|\s\s+|\n/gm," ");let r=[{}],i=[r[0]],o=[];for(;t=et.exec(e);)t[4]&&(r.shift(),o.shift()),t[3]?(o.unshift(t[3]),r.unshift({}),i.push(o.reduce((e,t)=>({[t]:e}),r[0]))):t[4]||(r[0][t[1]]&&(r.unshift({}),i.push(o.reduce((e,t)=>({[t]:e}),r[0]))),r[0][t[1]]=t[2]);return i}function ei(e,...t){var r;let i=ee(e,t),o=(i.find(e=>e.label)?.label||"css")+v(JSON.stringify(i));return r=(e,t)=>B(i.flatMap(r=>N(r,e,t,A.o)),o),F.set(o,r),o}function eo(e,t,r){return[e,en(t,r)]}function en(e,t){return"function"==typeof e?e:"string"==typeof e&&/^[\w-]+$/.test(e)?(r,i)=>({[e]:t?t(r,i):ea(r,1)}):t=>e||{[t[1]]:ea(t,2)}}function ea(e,t,r=e.slice(t).find(Boolean)||e.$$||e.input){return"-"==e.input[0]?`calc(${r} * -1)`:r}function el(e,t,r,i){let o;return[e,(o="string"==typeof r?(e,t)=>({[r]:i?i(e,t):e._}):r||(({1:e,_:t},r,i)=>({[e||i]:t})),(e,r)=>{let i=eu(t||e[1]),n=r.theme(i,e.$$)??ed(e.$$,i,r);if(null!=n)return e._=ea(e,0,n),o(e,r,i)})]}function es(e,t={},r){return[e,function(e={},t){return(r,i)=>{let{section:o=eu(r[0]).replace("-","")+"Color"}=e,[n,a]=(r.$$.match(/^(\[[^\]]+]|[^/]+?)(?:\/(.+))?$/)||[]).slice(1);if(!n)return;let l=i.theme(o,n)||ed(n,o,i);if(!l||"object"==typeof l)return;let{opacityVariable:s=`--tw-${r[0].replace(/-$/,"")}-opacity`,opacitySection:c=o.replace("Color","Opacity"),property:d=o,selector:u}=e,p=i.theme(c,a||"DEFAULT")||a&&ed(a,c,i),f=t||(({_:e})=>{let t=ec(d,e);return u?{[u]:t}:t});r._={value:H(l,{opacityVariable:s||void 0,opacityValue:p||void 0}),color:e=>H(l,e),opacityVariable:s||void 0,opacityValue:p||void 0};let g=f(r,i);if(!r.dark){let e=i.d(o,n,l);e&&e!==l&&(r._={value:H(e,{opacityVariable:s||void 0,opacityValue:p||"1"}),color:t=>H(e,t),opacityVariable:s||void 0,opacityValue:p||void 0},g={"&":g,[i.v("dark")]:f(r,i)})}return g}}(t,r)]}function ec(e,t){let r={};return"string"==typeof t?r[e]=t:(t.opacityVariable&&t.value.includes(t.opacityVariable)&&(r[t.opacityVariable]=t.opacityValue||"1"),r[e]=t.value),r}function ed(e,t,r){if("["==e[0]&&"]"==e.slice(-1)){if(e=ep(U(e.slice(1,-1),r.theme)),!t)return e;if(!(/color|fill|stroke/i.test(t)&&!(/^color:/.test(e)||/^(#|((hsl|rgb)a?|hwb|lab|lch|color)\(|[a-z]+$)/.test(e))||/image/i.test(t)&&!(/^image:/.test(e)||/^[a-z-]+\(/.test(e))||/weight/i.test(t)&&!(/^(number|any):/.test(e)||/^\d+$/.test(e))||/position/i.test(t)&&/^(length|size):/.test(e)))return e.replace(/^[a-z-]+:/,"")}}function eu(e){return e.replace(/-./g,e=>e[1].toUpperCase())}function ep(e){return e.includes("url(")?e.replace(/(.*?)(url\(.*?\))(.*?)/g,(e,t="",r,i="")=>ep(t)+r+ep(i)):e.replace(/(^|[^\\])_+/g,(e,t)=>t+" ".repeat(e.length-t.length)).replace(/\\_/g,"_").replace(/(calc|min|max|clamp)\(.+\)/g,e=>e.replace(/(-?\d*\.?\d(?!\b-.+[,)](?![^+\-/*])\D)(?:%|[a-z]+)?|\))([+\-/*])/g,"$1 $2 "))}function ef(e,...t){return x(Y(K(e,t))," ")}function eg({presets:e=[],...t}){let r={darkMode:void 0,darkColor:void 0,preflight:!1!==t.preflight&&[],theme:{},variants:$(t.variants),rules:$(t.rules),ignorelist:$(t.ignorelist),hash:void 0,stringify:(e,t)=>e+":"+t,finalize:[]};for(let i of $([...e,{darkMode:t.darkMode,darkColor:t.darkColor,preflight:!1!==t.preflight&&$(t.preflight),theme:t.theme,hash:t.hash,stringify:t.stringify,finalize:t.finalize}])){let{preflight:e,darkMode:t=r.darkMode,darkColor:o=r.darkColor,theme:n,variants:a,rules:l,ignorelist:s,hash:c=r.hash,stringify:d=r.stringify,finalize:u}="function"==typeof i?i(r):i;r={preflight:!1!==r.preflight&&!1!==e&&[...r.preflight,...$(e)],darkMode:t,darkColor:o,theme:{...r.theme,...n,extend:{...r.theme.extend,...n?.extend}},variants:[...r.variants,...$(a)],rules:[...r.rules,...$(l)],ignorelist:[...r.ignorelist,...$(s)],hash:c,stringify:d,finalize:[...r.finalize,...$(u)]}}return r}function em(e,t,r,i,o,n){for(let a of t){let t=r.get(a);t||r.set(a,t=i(a));let l=t(e,o,n);if(l)return l}}function eh(e){var t;return ew(e[0],"function"==typeof(t=e[1])?t:()=>t)}function eb(e){var t,r;return Array.isArray(e)?ew(e[0],en(e[1],e[2])):ew(e,en(t,r))}function ew(e,t){return ex(e,(e,r,i,o)=>{let n=r.exec(e);if(n)return n.$$=e.slice(n[0].length),n.dark=o,t(n,i)})}function ex(e,t){let r=$(e).map(ey);return(e,i,o)=>{for(let n of r){let r=t(e,n,i,o);if(r)return r}}}function ey(e){return"string"==typeof e?RegExp("^"+e+(e.includes("$")||"-"==e.slice(-1)?"":"$")):e}let ev=new Proxy(S,{apply:(e,t,r)=>i(r[0]),get(e,t){let r=i[t];return"function"==typeof r?function(){return r.apply(i,arguments)}:r}}),ek=function e(t){return new Proxy(function(e,...r){return e$(t,"",e,r)},{get:(r,i)=>"bind"===i?e:i in r?r[i]:function(e,...r){return e$(t,i,e,r)}})}();function e$(e,t,r,i){return{toString(){let o=y(t+v(JSON.stringify([t,ee(r,i)])));return("function"==typeof e?e:ev)(ei({[`@keyframes ${o}`]:ee(r,i)})),o}}}var eC=new Map([["align-self","-ms-grid-row-align"],["color-adjust","-webkit-print-color-adjust"],["column-gap","grid-column-gap"],["forced-color-adjust","-ms-high-contrast-adjust"],["gap","grid-gap"],["grid-template-columns","-ms-grid-columns"],["grid-template-rows","-ms-grid-rows"],["justify-self","-ms-grid-column-align"],["margin-inline-end","-webkit-margin-end"],["margin-inline-start","-webkit-margin-start"],["mask-border","-webkit-mask-box-image"],["mask-border-outset","-webkit-mask-box-image-outset"],["mask-border-slice","-webkit-mask-box-image-slice"],["mask-border-source","-webkit-mask-box-image-source"],["mask-border-repeat","-webkit-mask-box-image-repeat"],["mask-border-width","-webkit-mask-box-image-width"],["overflow-wrap","word-wrap"],["padding-inline-end","-webkit-padding-end"],["padding-inline-start","-webkit-padding-start"],["print-color-adjust","color-adjust"],["row-gap","grid-row-gap"],["scroll-margin-bottom","scroll-snap-margin-bottom"],["scroll-margin-left","scroll-snap-margin-left"],["scroll-margin-right","scroll-snap-margin-right"],["scroll-margin-top","scroll-snap-margin-top"],["scroll-margin","scroll-snap-margin"],["text-combine-upright","-ms-text-combine-horizontal"]]);let eS=[["-webkit-",1],["-moz-",2],["-ms-",4]],eA={screens:{sm:"640px",md:"768px",lg:"1024px",xl:"1280px","2xl":"1536px"},columns:{auto:"auto","3xs":"16rem","2xs":"18rem",xs:"20rem",sm:"24rem",md:"28rem",lg:"32rem",xl:"36rem","2xl":"42rem","3xl":"48rem","4xl":"56rem","5xl":"64rem","6xl":"72rem","7xl":"80rem"},spacing:{px:"1px",0:"0px",...ez(4,"rem",4,.5,.5),...ez(12,"rem",4,5),14:"3.5rem",...ez(64,"rem",4,16,4),72:"18rem",80:"20rem",96:"24rem"},durations:{75:"75ms",100:"100ms",150:"150ms",200:"200ms",300:"300ms",500:"500ms",700:"700ms",1e3:"1000ms"},animation:{none:"none",spin:"spin 1s linear infinite",ping:"ping 1s cubic-bezier(0,0,0.2,1) infinite",pulse:"pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",bounce:"bounce 1s infinite"},aspectRatio:{auto:"auto",square:"1/1",video:"16/9"},backdropBlur:eE("blur"),backdropBrightness:eE("brightness"),backdropContrast:eE("contrast"),backdropGrayscale:eE("grayscale"),backdropHueRotate:eE("hueRotate"),backdropInvert:eE("invert"),backdropOpacity:eE("opacity"),backdropSaturate:eE("saturate"),backdropSepia:eE("sepia"),backgroundColor:eE("colors"),backgroundImage:{none:"none"},backgroundOpacity:eE("opacity"),backgroundSize:{auto:"auto",cover:"cover",contain:"contain"},blur:{none:"none",0:"0",sm:"4px",DEFAULT:"8px",md:"12px",lg:"16px",xl:"24px","2xl":"40px","3xl":"64px"},brightness:{...ez(200,"",100,0,50),...ez(110,"",100,90,5),75:"0.75",125:"1.25"},borderColor:({theme:e})=>({DEFAULT:e("colors.gray.200","currentColor"),...e("colors")}),borderOpacity:eE("opacity"),borderRadius:{none:"0px",sm:"0.125rem",DEFAULT:"0.25rem",md:"0.375rem",lg:"0.5rem",xl:"0.75rem","2xl":"1rem","3xl":"1.5rem","1/2":"50%",full:"9999px"},borderSpacing:eE("spacing"),borderWidth:{DEFAULT:"1px",...eT(8,"px")},boxShadow:{sm:"0 1px 2px 0 rgba(0,0,0,0.05)",DEFAULT:"0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)",md:"0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",lg:"0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",xl:"0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)","2xl":"0 25px 50px -12px rgba(0,0,0,0.25)",inner:"inset 0 2px 4px 0 rgba(0,0,0,0.05)",none:"0 0 #0000"},boxShadowColor:eE("colors"),caretColor:eE("colors"),accentColor:({theme:e})=>({auto:"auto",...e("colors")}),contrast:{...ez(200,"",100,0,50),75:"0.75",125:"1.25"},content:{none:"none"},divideColor:eE("borderColor"),divideOpacity:eE("borderOpacity"),divideWidth:eE("borderWidth"),dropShadow:{sm:"0 1px 1px rgba(0,0,0,0.05)",DEFAULT:["0 1px 2px rgba(0,0,0,0.1)","0 1px 1px rgba(0,0,0,0.06)"],md:["0 4px 3px rgba(0,0,0,0.07)","0 2px 2px rgba(0,0,0,0.06)"],lg:["0 10px 8px rgba(0,0,0,0.04)","0 4px 3px rgba(0,0,0,0.1)"],xl:["0 20px 13px rgba(0,0,0,0.03)","0 8px 5px rgba(0,0,0,0.08)"],"2xl":"0 25px 25px rgba(0,0,0,0.15)",none:"0 0 #0000"},fill:({theme:e})=>({...e("colors"),none:"none"}),grayscale:{DEFAULT:"100%",0:"0"},hueRotate:{0:"0deg",15:"15deg",30:"30deg",60:"60deg",90:"90deg",180:"180deg"},invert:{DEFAULT:"100%",0:"0"},flex:{1:"1 1 0%",auto:"1 1 auto",initial:"0 1 auto",none:"none"},flexBasis:({theme:e})=>({...e("spacing"),...eL(2,6),...eL(12,12),auto:"auto",full:"100%"}),flexGrow:{DEFAULT:1,0:0},flexShrink:{DEFAULT:1,0:0},fontFamily:{sans:'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"'.split(","),serif:'ui-serif,Georgia,Cambria,"Times New Roman",Times,serif'.split(","),mono:'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace'.split(",")},fontSize:{xs:["0.75rem","1rem"],sm:["0.875rem","1.25rem"],base:["1rem","1.5rem"],lg:["1.125rem","1.75rem"],xl:["1.25rem","1.75rem"],"2xl":["1.5rem","2rem"],"3xl":["1.875rem","2.25rem"],"4xl":["2.25rem","2.5rem"],"5xl":["3rem","1"],"6xl":["3.75rem","1"],"7xl":["4.5rem","1"],"8xl":["6rem","1"],"9xl":["8rem","1"]},fontWeight:{thin:"100",extralight:"200",light:"300",normal:"400",medium:"500",semibold:"600",bold:"700",extrabold:"800",black:"900"},gap:eE("spacing"),gradientColorStops:eE("colors"),gridAutoColumns:{auto:"auto",min:"min-content",max:"max-content",fr:"minmax(0,1fr)"},gridAutoRows:{auto:"auto",min:"min-content",max:"max-content",fr:"minmax(0,1fr)"},gridColumn:{auto:"auto","span-full":"1 / -1"},gridRow:{auto:"auto","span-full":"1 / -1"},gridTemplateColumns:{none:"none"},gridTemplateRows:{none:"none"},height:({theme:e})=>({...e("spacing"),...eL(2,6),min:"min-content",max:"max-content",fit:"fit-content",auto:"auto",full:"100%",screen:"100vh"}),inset:({theme:e})=>({...e("spacing"),...eL(2,4),auto:"auto",full:"100%"}),keyframes:{spin:{from:{transform:"rotate(0deg)"},to:{transform:"rotate(360deg)"}},ping:{"0%":{transform:"scale(1)",opacity:"1"},"75%,100%":{transform:"scale(2)",opacity:"0"}},pulse:{"0%,100%":{opacity:"1"},"50%":{opacity:".5"}},bounce:{"0%, 100%":{transform:"translateY(-25%)",animationTimingFunction:"cubic-bezier(0.8,0,1,1)"},"50%":{transform:"none",animationTimingFunction:"cubic-bezier(0,0,0.2,1)"}}},letterSpacing:{tighter:"-0.05em",tight:"-0.025em",normal:"0em",wide:"0.025em",wider:"0.05em",widest:"0.1em"},lineHeight:{...ez(10,"rem",4,3),none:"1",tight:"1.25",snug:"1.375",normal:"1.5",relaxed:"1.625",loose:"2"},margin:({theme:e})=>({auto:"auto",...e("spacing")}),maxHeight:({theme:e})=>({full:"100%",min:"min-content",max:"max-content",fit:"fit-content",screen:"100vh",...e("spacing")}),maxWidth:({theme:e,breakpoints:t})=>({...t(e("screens")),none:"none",0:"0rem",xs:"20rem",sm:"24rem",md:"28rem",lg:"32rem",xl:"36rem","2xl":"42rem","3xl":"48rem","4xl":"56rem","5xl":"64rem","6xl":"72rem","7xl":"80rem",full:"100%",min:"min-content",max:"max-content",fit:"fit-content",prose:"65ch"}),minHeight:{0:"0px",full:"100%",min:"min-content",max:"max-content",fit:"fit-content",screen:"100vh"},minWidth:{0:"0px",full:"100%",min:"min-content",max:"max-content",fit:"fit-content"},opacity:{...ez(100,"",100,0,10),5:"0.05",25:"0.25",75:"0.75",95:"0.95"},order:{first:"-9999",last:"9999",none:"0"},padding:eE("spacing"),placeholderColor:eE("colors"),placeholderOpacity:eE("opacity"),outlineColor:eE("colors"),outlineOffset:eT(8,"px"),outlineWidth:eT(8,"px"),ringColor:({theme:e})=>({...e("colors"),DEFAULT:"#3b82f6"}),ringOffsetColor:eE("colors"),ringOffsetWidth:eT(8,"px"),ringOpacity:({theme:e})=>({...e("opacity"),DEFAULT:"0.5"}),ringWidth:{DEFAULT:"3px",...eT(8,"px")},rotate:{...eT(2,"deg"),...eT(12,"deg",3),...eT(180,"deg",45)},saturate:ez(200,"",100,0,50),scale:{...ez(150,"",100,0,50),...ez(110,"",100,90,5),75:"0.75",125:"1.25"},scrollMargin:eE("spacing"),scrollPadding:eE("spacing"),sepia:{0:"0",DEFAULT:"100%"},skew:{...eT(2,"deg"),...eT(12,"deg",3)},space:eE("spacing"),stroke:({theme:e})=>({...e("colors"),none:"none"}),strokeWidth:ez(2),textColor:eE("colors"),textDecorationColor:eE("colors"),textDecorationThickness:{"from-font":"from-font",auto:"auto",...eT(8,"px")},textUnderlineOffset:{auto:"auto",...eT(8,"px")},textIndent:eE("spacing"),textOpacity:eE("opacity"),transitionDuration:({theme:e})=>({...e("durations"),DEFAULT:"150ms"}),transitionDelay:eE("durations"),transitionProperty:{none:"none",all:"all",DEFAULT:"color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter",colors:"color,background-color,border-color,text-decoration-color,fill,stroke",opacity:"opacity",shadow:"box-shadow",transform:"transform"},transitionTimingFunction:{DEFAULT:"cubic-bezier(0.4,0,0.2,1)",linear:"linear",in:"cubic-bezier(0.4,0,1,1)",out:"cubic-bezier(0,0,0.2,1)","in-out":"cubic-bezier(0.4,0,0.2,1)"},translate:({theme:e})=>({...e("spacing"),...eL(2,4),full:"100%"}),width:({theme:e})=>({min:"min-content",max:"max-content",fit:"fit-content",screen:"100vw",...e("flexBasis")}),willChange:{scroll:"scroll-position"},zIndex:{...ez(50,"",1,0,10),auto:"auto"}};function eL(e,t){let r={};do for(var i=1;i<e;i++)r[`${i}/${e}`]=Number((i/e*100).toFixed(6))+"%";while(++e<=t);return r}function eT(e,t,r=0){let i={};for(;r<=e;r=2*r||1)i[r]=r+t;return i}function ez(e,t="",r=1,i=0,o=1,n={}){for(;i<=e;i+=o)n[i]=i/r+t;return n}function eE(e){return({theme:t})=>t(e)}let eF={"*,::before,::after":{boxSizing:"border-box",borderWidth:"0",borderStyle:"solid",borderColor:"theme(borderColor.DEFAULT, currentColor)"},"::before,::after":{"--tw-content":"''"},html:{lineHeight:1.5,WebkitTextSizeAdjust:"100%",MozTabSize:"4",tabSize:4,fontFamily:`theme(fontFamily.sans, ${eA.fontFamily.sans})`,fontFeatureSettings:"theme(fontFamily.sans[1].fontFeatureSettings, normal)"},body:{margin:"0",lineHeight:"inherit"},hr:{height:"0",color:"inherit",borderTopWidth:"1px"},"abbr:where([title])":{textDecoration:"underline dotted"},"h1,h2,h3,h4,h5,h6":{fontSize:"inherit",fontWeight:"inherit"},a:{color:"inherit",textDecoration:"inherit"},"b,strong":{fontWeight:"bolder"},"code,kbd,samp,pre":{fontFamily:`theme(fontFamily.mono, ${eA.fontFamily.mono})`,fontFeatureSettings:"theme(fontFamily.mono[1].fontFeatureSettings, normal)",fontSize:"1em"},small:{fontSize:"80%"},"sub,sup":{fontSize:"75%",lineHeight:0,position:"relative",verticalAlign:"baseline"},sub:{bottom:"-0.25em"},sup:{top:"-0.5em"},table:{textIndent:"0",borderColor:"inherit",borderCollapse:"collapse"},"button,input,optgroup,select,textarea":{fontFamily:"inherit",fontSize:"100%",lineHeight:"inherit",color:"inherit",margin:"0",padding:"0"},"button,select":{textTransform:"none"},"button,[type='button'],[type='reset'],[type='submit']":{WebkitAppearance:"button",backgroundColor:"transparent",backgroundImage:"none"},":-moz-focusring":{outline:"auto"},":-moz-ui-invalid":{boxShadow:"none"},progress:{verticalAlign:"baseline"},"::-webkit-inner-spin-button,::-webkit-outer-spin-button":{height:"auto"},"[type='search']":{WebkitAppearance:"textfield",outlineOffset:"-2px"},"::-webkit-search-decoration":{WebkitAppearance:"none"},"::-webkit-file-upload-button":{WebkitAppearance:"button",font:"inherit"},summary:{display:"list-item"},"blockquote,dl,dd,h1,h2,h3,h4,h5,h6,hr,figure,p,pre":{margin:"0"},fieldset:{margin:"0",padding:"0"},legend:{padding:"0"},"ol,ul,menu":{listStyle:"none",margin:"0",padding:"0"},textarea:{resize:"vertical"},"input::placeholder,textarea::placeholder":{opacity:1,color:"theme(colors.gray.400, #9ca3af)"},'button,[role="button"]':{cursor:"pointer"},":disabled":{cursor:"default"},"img,svg,video,canvas,audio,iframe,embed,object":{display:"block",verticalAlign:"middle"},"img,video":{maxWidth:"100%",height:"auto"},"[hidden]":{display:"none"}},eO=[eo("\\[([-\\w]+):(.+)]",({1:e,2:t},r)=>({"@layer overrides":{"&":{[e]:ed(`[${t}]`,"",r)}}})),eo("(group|peer)([~/][^-[]+)?",({input:e},{h:t})=>[{c:t(e)}]),el("aspect-","aspectRatio"),eo("container",(e,{theme:t})=>{let{screens:r=t("screens"),center:i,padding:o}=t("container"),n={width:"100%",marginRight:i&&"auto",marginLeft:i&&"auto",...a("xs")};for(let e in r){let t=r[e];"string"==typeof t&&(n[k(t)]={"&":{maxWidth:t,...a(e)}})}return n;function a(e){let t=o&&("string"==typeof o?o:o[e]||o.DEFAULT);if(t)return{paddingRight:t,paddingLeft:t}}}),el("content-","content",({_:e})=>({"--tw-content":e,content:"var(--tw-content)"})),eo("(?:box-)?decoration-(slice|clone)","boxDecorationBreak"),eo("box-(border|content)","boxSizing",({1:e})=>e+"-box"),eo("hidden",{display:"none"}),eo("table-(auto|fixed)","tableLayout"),eo(["(block|flex|table|grid|inline|contents|flow-root|list-item)","(inline-(block|flex|table|grid))","(table-(caption|cell|column|row|(column|row|footer|header)-group))"],"display"),"(float)-(left|right|none)","(clear)-(left|right|none|both)","(overflow(?:-[xy])?)-(auto|hidden|clip|visible|scroll)","(isolation)-(auto)",eo("isolate","isolation"),eo("object-(contain|cover|fill|none|scale-down)","objectFit"),el("object-","objectPosition"),eo("object-(top|bottom|center|(left|right)(-(top|bottom))?)","objectPosition",eM),eo("overscroll(-[xy])?-(auto|contain|none)",({1:e="",2:t})=>({["overscroll-behavior"+e]:t})),eo("(static|fixed|absolute|relative|sticky)","position"),el("-?inset(-[xy])?(?:$|-)","inset",({1:e,_:t})=>({top:"-x"!=e&&t,right:"-y"!=e&&t,bottom:"-x"!=e&&t,left:"-y"!=e&&t})),el("-?(top|bottom|left|right)(?:$|-)","inset"),eo("(visible|collapse)","visibility"),eo("invisible",{visibility:"hidden"}),el("-?z-","zIndex"),eo("flex-((row|col)(-reverse)?)","flexDirection",eW),eo("flex-(wrap|wrap-reverse|nowrap)","flexWrap"),el("(flex-(?:grow|shrink))(?:$|-)"),el("(flex)-"),el("grow(?:$|-)","flexGrow"),el("shrink(?:$|-)","flexShrink"),el("basis-","flexBasis"),el("-?(order)-"),"-?(order)-(\\d+)",el("grid-cols-","gridTemplateColumns"),eo("grid-cols-(\\d+)","gridTemplateColumns",eB),el("col-","gridColumn"),eo("col-(span)-(\\d+)","gridColumn",eU),el("col-start-","gridColumnStart"),eo("col-start-(auto|\\d+)","gridColumnStart"),el("col-end-","gridColumnEnd"),eo("col-end-(auto|\\d+)","gridColumnEnd"),el("grid-rows-","gridTemplateRows"),eo("grid-rows-(\\d+)","gridTemplateRows",eB),el("row-","gridRow"),eo("row-(span)-(\\d+)","gridRow",eU),el("row-start-","gridRowStart"),eo("row-start-(auto|\\d+)","gridRowStart"),el("row-end-","gridRowEnd"),eo("row-end-(auto|\\d+)","gridRowEnd"),eo("grid-flow-((row|col)(-dense)?)","gridAutoFlow",e=>eM(eW(e))),eo("grid-flow-(dense)","gridAutoFlow"),el("auto-cols-","gridAutoColumns"),el("auto-rows-","gridAutoRows"),el("gap-x(?:$|-)","gap","columnGap"),el("gap-y(?:$|-)","gap","rowGap"),el("gap(?:$|-)","gap"),"(justify-(?:items|self))-",eo("justify-","justifyContent",eD),eo("(content|items|self)-",e=>({["align-"+e[1]]:eD(e)})),eo("(place-(content|items|self))-",({1:e,$$:t})=>({[e]:("wun".includes(t[3])?"space-":"")+t})),el("p([xytrbl])?(?:$|-)","padding",eI("padding")),el("-?m([xytrbl])?(?:$|-)","margin",eI("margin")),el("-?space-(x|y)(?:$|-)","space",({1:e,_:t})=>({"&>:not([hidden])~:not([hidden])":{[`--tw-space-${e}-reverse`]:"0",["margin-"+({y:"top",x:"left"})[e]]:`calc(${t} * calc(1 - var(--tw-space-${e}-reverse)))`,["margin-"+({y:"bottom",x:"right"})[e]]:`calc(${t} * var(--tw-space-${e}-reverse))`}})),eo("space-(x|y)-reverse",({1:e})=>({"&>:not([hidden])~:not([hidden])":{[`--tw-space-${e}-reverse`]:"1"}})),el("w-","width"),el("min-w-","minWidth"),el("max-w-","maxWidth"),el("h-","height"),el("min-h-","minHeight"),el("max-h-","maxHeight"),el("font-","fontWeight"),el("font-","fontFamily",({_:e})=>"string"==typeof(e=$(e))[1]?{fontFamily:eR(e)}:{fontFamily:eR(e[0]),...e[1]}),eo("antialiased",{WebkitFontSmoothing:"antialiased",MozOsxFontSmoothing:"grayscale"}),eo("subpixel-antialiased",{WebkitFontSmoothing:"auto",MozOsxFontSmoothing:"auto"}),eo("italic","fontStyle"),eo("not-italic",{fontStyle:"normal"}),eo("(ordinal|slashed-zero|(normal|lining|oldstyle|proportional|tabular)-nums|(diagonal|stacked)-fractions)",({1:e,2:t="",3:r})=>"normal"==t?{fontVariantNumeric:"normal"}:{["--tw-"+(r?"numeric-fraction":"pt".includes(t[0])?"numeric-spacing":t?"numeric-figure":e)]:e,fontVariantNumeric:"var(--tw-ordinal) var(--tw-slashed-zero) var(--tw-numeric-figure) var(--tw-numeric-spacing) var(--tw-numeric-fraction)",...e_({"--tw-ordinal":"var(--tw-empty,/*!*/ /*!*/)","--tw-slashed-zero":"var(--tw-empty,/*!*/ /*!*/)","--tw-numeric-figure":"var(--tw-empty,/*!*/ /*!*/)","--tw-numeric-spacing":"var(--tw-empty,/*!*/ /*!*/)","--tw-numeric-fraction":"var(--tw-empty,/*!*/ /*!*/)"})}),el("tracking-","letterSpacing"),el("leading-","lineHeight"),eo("list-(inside|outside)","listStylePosition"),el("list-","listStyleType"),eo("list-","listStyleType"),el("placeholder-opacity-","placeholderOpacity",({_:e})=>({"&::placeholder":{"--tw-placeholder-opacity":e}})),es("placeholder-",{property:"color",selector:"&::placeholder"}),eo("text-(left|center|right|justify|start|end)","textAlign"),eo("text-(ellipsis|clip)","textOverflow"),el("text-opacity-","textOpacity","--tw-text-opacity"),es("text-",{property:"color"}),el("text-","fontSize",({_:e})=>"string"==typeof e?{fontSize:e}:{fontSize:e[0],..."string"==typeof e[1]?{lineHeight:e[1]}:e[1]}),el("indent-","textIndent"),eo("(overline|underline|line-through)","textDecorationLine"),eo("no-underline",{textDecorationLine:"none"}),el("underline-offset-","textUnderlineOffset"),es("decoration-",{section:"textDecorationColor",opacityVariable:!1,opacitySection:"opacity"}),el("decoration-","textDecorationThickness"),eo("decoration-","textDecorationStyle"),eo("(uppercase|lowercase|capitalize)","textTransform"),eo("normal-case",{textTransform:"none"}),eo("truncate",{overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}),eo("align-","verticalAlign"),eo("whitespace-","whiteSpace"),eo("break-normal",{wordBreak:"normal",overflowWrap:"normal"}),eo("break-words",{overflowWrap:"break-word"}),eo("break-all",{wordBreak:"break-all"}),eo("break-keep",{wordBreak:"keep-all"}),es("caret-",{opacityVariable:!1,opacitySection:"opacity"}),es("accent-",{opacityVariable:!1,opacitySection:"opacity"}),eo("bg-gradient-to-([trbl]|[tb][rl])","backgroundImage",({1:e})=>`linear-gradient(to ${ej(e," ")},var(--tw-gradient-stops))`),es("from-",{section:"gradientColorStops",opacityVariable:!1,opacitySection:"opacity"},({_:e})=>({"--tw-gradient-from":e.value,"--tw-gradient-to":e.color({opacityValue:"0"}),"--tw-gradient-stops":"var(--tw-gradient-from),var(--tw-gradient-to)"})),es("via-",{section:"gradientColorStops",opacityVariable:!1,opacitySection:"opacity"},({_:e})=>({"--tw-gradient-to":e.color({opacityValue:"0"}),"--tw-gradient-stops":`var(--tw-gradient-from),${e.value},var(--tw-gradient-to)`})),es("to-",{section:"gradientColorStops",property:"--tw-gradient-to",opacityVariable:!1,opacitySection:"opacity"}),eo("bg-(fixed|local|scroll)","backgroundAttachment"),eo("bg-origin-(border|padding|content)","backgroundOrigin",({1:e})=>e+"-box"),eo(["bg-(no-repeat|repeat(-[xy])?)","bg-repeat-(round|space)"],"backgroundRepeat"),eo("bg-blend-","backgroundBlendMode"),eo("bg-clip-(border|padding|content|text)","backgroundClip",({1:e})=>e+("text"==e?"":"-box")),el("bg-opacity-","backgroundOpacity","--tw-bg-opacity"),es("bg-",{section:"backgroundColor"}),el("bg-","backgroundImage"),el("bg-","backgroundPosition"),eo("bg-(top|bottom|center|(left|right)(-(top|bottom))?)","backgroundPosition",eM),el("bg-","backgroundSize"),el("rounded(?:$|-)","borderRadius"),el("rounded-([trbl]|[tb][rl])(?:$|-)","borderRadius",({1:e,_:t})=>{let r={t:["tl","tr"],r:["tr","br"],b:["bl","br"],l:["bl","tl"]}[e]||[e,e];return{[`border-${ej(r[0])}-radius`]:t,[`border-${ej(r[1])}-radius`]:t}}),eo("border-(collapse|separate)","borderCollapse"),el("border-opacity(?:$|-)","borderOpacity","--tw-border-opacity"),eo("border-(solid|dashed|dotted|double|none)","borderStyle"),el("border-spacing(-[xy])?(?:$|-)","borderSpacing",({1:e,_:t})=>({...e_({"--tw-border-spacing-x":"0","--tw-border-spacing-y":"0"}),["--tw-border-spacing"+(e||"-x")]:t,["--tw-border-spacing"+(e||"-y")]:t,"border-spacing":"var(--tw-border-spacing-x) var(--tw-border-spacing-y)"})),es("border-([xytrbl])-",{section:"borderColor"},eI("border","Color")),es("border-"),el("border-([xytrbl])(?:$|-)","borderWidth",eI("border","Width")),el("border(?:$|-)","borderWidth"),el("divide-opacity(?:$|-)","divideOpacity",({_:e})=>({"&>:not([hidden])~:not([hidden])":{"--tw-divide-opacity":e}})),eo("divide-(solid|dashed|dotted|double|none)",({1:e})=>({"&>:not([hidden])~:not([hidden])":{borderStyle:e}})),eo("divide-([xy]-reverse)",({1:e})=>({"&>:not([hidden])~:not([hidden])":{["--tw-divide-"+e]:"1"}})),el("divide-([xy])(?:$|-)","divideWidth",({1:e,_:t})=>{let r={x:"lr",y:"tb"}[e];return{"&>:not([hidden])~:not([hidden])":{[`--tw-divide-${e}-reverse`]:"0",[`border-${ej(r[0])}Width`]:`calc(${t} * calc(1 - var(--tw-divide-${e}-reverse)))`,[`border-${ej(r[1])}Width`]:`calc(${t} * var(--tw-divide-${e}-reverse))`}}}),es("divide-",{property:"borderColor",selector:"&>:not([hidden])~:not([hidden])"}),el("ring-opacity(?:$|-)","ringOpacity","--tw-ring-opacity"),es("ring-offset-",{property:"--tw-ring-offset-color",opacityVariable:!1}),el("ring-offset(?:$|-)","ringOffsetWidth","--tw-ring-offset-width"),eo("ring-inset",{"--tw-ring-inset":"inset"}),es("ring-",{property:"--tw-ring-color"}),el("ring(?:$|-)","ringWidth",({_:e},{theme:t})=>({...e_({"--tw-ring-offset-shadow":"0 0 #0000","--tw-ring-shadow":"0 0 #0000","--tw-shadow":"0 0 #0000","--tw-shadow-colored":"0 0 #0000","&":{"--tw-ring-inset":"var(--tw-empty,/*!*/ /*!*/)","--tw-ring-offset-width":t("ringOffsetWidth","","0px"),"--tw-ring-offset-color":H(t("ringOffsetColor","","#fff")),"--tw-ring-color":H(t("ringColor","","#93c5fd"),{opacityVariable:"--tw-ring-opacity"}),"--tw-ring-opacity":t("ringOpacity","","0.5")}}),"--tw-ring-offset-shadow":"var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)","--tw-ring-shadow":`var(--tw-ring-inset) 0 0 0 calc(${e} + var(--tw-ring-offset-width)) var(--tw-ring-color)`,boxShadow:"var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)"})),es("shadow-",{section:"boxShadowColor",opacityVariable:!1,opacitySection:"opacity"},({_:e})=>({"--tw-shadow-color":e.value,"--tw-shadow":"var(--tw-shadow-colored)"})),el("shadow(?:$|-)","boxShadow",({_:e})=>({...e_({"--tw-ring-offset-shadow":"0 0 #0000","--tw-ring-shadow":"0 0 #0000","--tw-shadow":"0 0 #0000","--tw-shadow-colored":"0 0 #0000"}),"--tw-shadow":eR(e),"--tw-shadow-colored":eR(e).replace(/([^,]\s+)(?:#[a-f\d]+|(?:(?:hsl|rgb)a?|hwb|lab|lch|color|var)\(.+?\)|[a-z]+)(,|$)/g,"$1var(--tw-shadow-color)$2"),boxShadow:"var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow)"})),el("(opacity)-"),eo("mix-blend-","mixBlendMode"),...eP(),...eP("backdrop-"),el("transition(?:$|-)","transitionProperty",(e,{theme:t})=>({transitionProperty:eR(e),transitionTimingFunction:"none"==e._?void 0:eR(t("transitionTimingFunction","")),transitionDuration:"none"==e._?void 0:eR(t("transitionDuration",""))})),el("duration(?:$|-)","transitionDuration","transitionDuration",eR),el("ease(?:$|-)","transitionTimingFunction","transitionTimingFunction",eR),el("delay(?:$|-)","transitionDelay","transitionDelay",eR),el("animate(?:$|-)","animation",(e,{theme:t,h:r,e:i})=>{let o=eR(e),n=o.split(" "),a=t("keyframes",n[0]);return a?{["@keyframes "+(n[0]=i(r(n[0])))]:a,animation:n.join(" ")}:{animation:o}}),"(transform)-(none)",eo("transform",eH),eo("transform-(cpu|gpu)",({1:e})=>({"--tw-transform":eN("gpu"==e)})),el("scale(-[xy])?-","scale",({1:e,_:t})=>({["--tw-scale"+(e||"-x")]:t,["--tw-scale"+(e||"-y")]:t,...eH()})),el("-?(rotate)-","rotate",eV),el("-?(translate-[xy])-","translate",eV),el("-?(skew-[xy])-","skew",eV),eo("origin-(center|((top|bottom)(-(left|right))?)|left|right)","transformOrigin",eM),"(appearance)-",el("(columns)-"),"(columns)-(\\d+)","(break-(?:before|after|inside))-",el("(cursor)-"),"(cursor)-",eo("snap-(none)","scroll-snap-type"),eo("snap-(x|y|both)",({1:e})=>({...e_({"--tw-scroll-snap-strictness":"proximity"}),"scroll-snap-type":e+" var(--tw-scroll-snap-strictness)"})),eo("snap-(mandatory|proximity)","--tw-scroll-snap-strictness"),eo("snap-(?:(start|end|center)|align-(none))","scroll-snap-align"),eo("snap-(normal|always)","scroll-snap-stop"),eo("scroll-(auto|smooth)","scroll-behavior"),el("scroll-p([xytrbl])?(?:$|-)","padding",eI("scroll-padding")),el("-?scroll-m([xytrbl])?(?:$|-)","scroll-margin",eI("scroll-margin")),eo("touch-(auto|none|manipulation)","touch-action"),eo("touch-(pinch-zoom|pan-(?:(x|left|right)|(y|up|down)))",({1:e,2:t,3:r})=>({...e_({"--tw-pan-x":"var(--tw-empty,/*!*/ /*!*/)","--tw-pan-y":"var(--tw-empty,/*!*/ /*!*/)","--tw-pinch-zoom":"var(--tw-empty,/*!*/ /*!*/)","--tw-touch-action":"var(--tw-pan-x) var(--tw-pan-y) var(--tw-pinch-zoom)"}),[`--tw-${t?"pan-x":r?"pan-y":e}`]:e,"touch-action":"var(--tw-touch-action)"})),eo("outline-none",{outline:"2px solid transparent","outline-offset":"2px"}),eo("outline",{outlineStyle:"solid"}),eo("outline-(dashed|dotted|double)","outlineStyle"),el("-?(outline-offset)-"),es("outline-",{opacityVariable:!1,opacitySection:"opacity"}),el("outline-","outlineWidth"),"(pointer-events)-",el("(will-change)-"),"(will-change)-",["resize(?:-(none|x|y))?","resize",({1:e})=>({x:"horizontal",y:"vertical"})[e]||e||"both"],eo("select-(none|text|all|auto)","userSelect"),es("fill-",{section:"fill",opacityVariable:!1,opacitySection:"opacity"}),es("stroke-",{section:"stroke",opacityVariable:!1,opacitySection:"opacity"}),el("stroke-","strokeWidth"),eo("sr-only",{position:"absolute",width:"1px",height:"1px",padding:"0",margin:"-1px",overflow:"hidden",whiteSpace:"nowrap",clip:"rect(0,0,0,0)",borderWidth:"0"}),eo("not-sr-only",{position:"static",width:"auto",height:"auto",padding:"0",margin:"0",overflow:"visible",whiteSpace:"normal",clip:"auto"})];function eM(e){return("string"==typeof e?e:e[1]).replace(/-/g," ").trim()}function eW(e){return("string"==typeof e?e:e[1]).replace("col","column")}function ej(e,t="-"){let r=[];for(let t of e)r.push({t:"top",r:"right",b:"bottom",l:"left"}[t]);return r.join(t)}function eR(e){return e&&""+(e._||e)}function eD({$$:e}){return(({r:"flex-","":"flex-",w:"space-",u:"space-",n:"space-"})[e[3]||""]||"")+e}function eI(e,t=""){return({1:r,_:i})=>{let o={x:"lr",y:"tb"}[r]||r+r;return o?{...ec(e+"-"+ej(o[0])+t,i),...ec(e+"-"+ej(o[1])+t,i)}:ec(e+t,i)}}function eP(e=""){let t=["blur","brightness","contrast","grayscale","hue-rotate","invert",e&&"opacity","saturate","sepia",!e&&"drop-shadow"].filter(Boolean),r={};for(let i of t)r[`--tw-${e}${i}`]="var(--tw-empty,/*!*/ /*!*/)";return r={...e_(r),[`${e}filter`]:t.map(t=>`var(--tw-${e}${t})`).join(" ")},[`(${e}filter)-(none)`,eo(`${e}filter`,r),...t.map(t=>el(`${"h"==t[0]?"-?":""}(${e}${t})(?:$|-)`,t,({1:e,_:i})=>({[`--tw-${e}`]:$(i).map(e=>`${t}(${e})`).join(" "),...r})))]}function eV({1:e,_:t}){return{["--tw-"+e]:t,...eH()}}function eH(){return{...e_({"--tw-translate-x":"0","--tw-translate-y":"0","--tw-rotate":"0","--tw-skew-x":"0","--tw-skew-y":"0","--tw-scale-x":"1","--tw-scale-y":"1","--tw-transform":eN()}),transform:"var(--tw-transform)"}}function eN(e){return[e?"translate3d(var(--tw-translate-x),var(--tw-translate-y),0)":"translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y))","rotate(var(--tw-rotate))","skewX(var(--tw-skew-x))","skewY(var(--tw-skew-y))","scaleX(var(--tw-scale-x))","scaleY(var(--tw-scale-y))"].join(" ")}function eU({1:e,2:t}){return`${e} ${t} / ${e} ${t}`}function eB({1:e}){return`repeat(${e},minmax(0,1fr))`}function e_(e){return{"@layer defaults":{"*,::before,::after":e,"::backdrop":e}}}let eZ=[["sticky","@supports ((position: -webkit-sticky) or (position:sticky))"],["motion-reduce","@media (prefers-reduced-motion:reduce)"],["motion-safe","@media (prefers-reduced-motion:no-preference)"],["print","@media print"],["(portrait|landscape)",({1:e})=>`@media (orientation:${e})`],["contrast-(more|less)",({1:e})=>`@media (prefers-contrast:${e})`],["(first-(letter|line)|placeholder|backdrop|before|after)",({1:e})=>`&::${e}`],["(marker|selection)",({1:e})=>`& *::${e},&::${e}`],["file","&::file-selector-button"],["(first|last|only)",({1:e})=>`&:${e}-child`],["even","&:nth-child(2n)"],["odd","&:nth-child(odd)"],["open","&[open]"],["(aria|data)-",({1:e,$$:t},r)=>t&&`&[${e}-${r.theme(e,t)||ed(t,"",r)||`${t}="true"`}]`],["((group|peer)(~[^-[]+)?)(-\\[(.+)]|[-[].+?)(\\/.+)?",({2:e,3:t="",4:r,5:i="",6:o=t},{e:n,h:a,v:l})=>{let s=ep(i)||("["==r[0]?r:l(r.slice(1)));return`${(s.includes("&")?s:"&"+s).replace(/&/g,`:merge(.${n(a(e+o))})`)}${"p"==e[0]?"~":" "}&`}],["(ltr|rtl)",({1:e})=>`[dir="${e}"] &`],["supports-",({$$:e},t)=>{if(e&&(e=t.theme("supports",e)||ed(e,"",t)),e)return e.includes(":")||(e+=":var(--tw)"),/^\w*\s*\(/.test(e)||(e=`(${e})`),`@supports ${e.replace(/\b(and|or|not)\b/g," $1 ").trim()}`}],["max-",({$$:e},t)=>{if(e&&(e=t.theme("screens",e)||ed(e,"",t)),"string"==typeof e)return`@media not all and (min-width:${e})`}],["min-",({$$:e},t)=>(e&&(e=ed(e,"",t)),e&&`@media (min-width:${e})`)],[/^\[(.+)]$/,({1:e})=>/[&@]/.test(e)&&ep(e).replace(/[}]+$/,"").split("{")]],eJ=function(e,t){let r=eg(e),i=function({theme:e,darkMode:t,darkColor:r=S,variants:i,rules:o,hash:n,stringify:a,ignorelist:l,finalize:s}){let c=new Map,d=new Map,u=new Map,p=new Map,f=ex(l,(e,t)=>t.test(e));i.push(["dark",Array.isArray(t)||"class"==t?`${$(t)[1]||".dark"} &`:"string"==typeof t&&"media"!=t?t:"@media (prefers-color-scheme:dark)"]);let g="function"==typeof n?e=>n(e,v):n?v:C;g!==C&&s.push(e=>({...e,n:e.n&&g(e.n),d:e.d?.replace(/--(tw(?:-[\w-]+)?)\b/g,(e,t)=>"--"+g(t).replace("#",""))}));let m={theme:function({extend:e={},...t}){let r={},i={get colors(){return o("colors")},theme:o,negative:()=>({}),breakpoints(e){let t={};for(let r in e)"string"==typeof e[r]&&(t["screen-"+r]=e[r]);return t}};return o;function o(i,a,l,s){if(i){if({1:i,2:s}=/^(\S+?)(?:\s*\/\s*([^/]+))?$/.exec(i)||[,i],/[.[]/.test(i)){let e=[];i.replace(/\[([^\]]+)\]|([^.[]+)/g,(t,r,i=r)=>e.push(i)),i=e.shift(),l=a,a=e.join("-")}let c=r[i]||Object.assign(Object.assign(r[i]={},n(t,i)),n(e,i));if(null==a)return c;a||(a="DEFAULT");let d=c[a]??a.split("-").reduce((e,t)=>e?.[t],c)??l;return s?H(d,{opacityValue:U(s,o)}):d}let c={};for(let r of[...Object.keys(t),...Object.keys(e)])c[r]=o(r);return c}function n(e,t){let r=e[t];return("function"==typeof r&&(r=r(i)),r&&/color|fill|stroke/i.test(t))?function e(t,r=[]){let i={};for(let o in t){let n=t[o],a=[...r,o];i[a.join("-")]=n,"DEFAULT"==o&&(a=r,i[r.join("-")]=n),"object"==typeof n&&Object.assign(i,e(n,a))}return i}(r):r}}(e),e:y,h:g,s:(e,t)=>a(e,t,m),d:(e,t,i)=>r(e,t,m,i),v:e=>(c.has(e)||c.set(e,em(e,i,d,eh,m)||"&:"+e),c.get(e)),r(e,t){let r=JSON.stringify([e,t]);return u.has(r)||u.set(r,!f(e,m)&&em(e,o,p,eb,m,t)),u.get(r)},f:e=>s.reduce((e,t)=>t(e,m),e)};return m}(r),o=new Map,n=[],a=new Set;function l(e){let r=i.f(e),o=O(r);if(o&&!a.has(o)){a.add(o);let r=R(n,e);t.insert(o,r,e),n.splice(r,0,e)}return r.n}return t.resume(e=>o.set(e,e),(e,r)=>{t.insert(e,n.length,r),n.push(r),a.add(e)}),Object.defineProperties(function(e){if(!o.size)for(let e of $(r.preflight))"function"==typeof e&&(e=e(i)),e&&("string"==typeof e?Z("",A.b,Y(e),i,A.b,[],!1,!0):N(e,{},i,A.b)).forEach(l);e=""+e;let t=o.get(e);if(!t){let r=new Set;for(let t of _(Y(e),i))r.add(t.c).add(l(t));t=[...r].filter(Boolean).join(" "),o.set(e,t).set(t,t)}return t},Object.getOwnPropertyDescriptors({get target(){return t.target},theme:i.theme,config:r,snapshot(){let e=t.snapshot(),r=new Set(a),i=new Map(o),l=[...n];return()=>{e(),a=r,o=i,n=l}},clear(){t.clear(),a=new Set,o=new Map,n=[]},destroy(){this.clear(),t.destroy()}}))}(eg({preflight:!1,hash:!0,darkMode:"class",theme:{extend:{colors:{background:"var(--swk-background)","background-secondary":"var(--swk-background-secondary)","foreground-strong":"var(--swk-foreground-strong)",foreground:"var(--swk-foreground)","foreground-secondary":"var(--swk-foreground-secondary)",primary:"var(--swk-primary)","primary-foreground":"var(--swk-primary-foreground)",transparent:"var(--swk-transparent)",lighter:"var(--swk-lighter)",light:"var(--swk-light)","light-gray":"var(--swk-light-gray)",gray:"var(--swk-gray)",danger:"var(--swk-danger)",border:"var(--swk-border)"},boxShadow:{default:"0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)"},borderRadius:{default:"var(--swk-border-radius)"},fontFamily:{default:"var(--swk-font-family)"}}},presets:[({stringify:e})=>({stringify(t,r,i){var o,n;let a="",l=eC.get(t);l&&(a+=e(l,r,i)+";");let s=(o=/^(?:(text-(?:decoration$|e|or|si)|back(?:ground-cl|d|f)|box-d|mask(?:$|-[ispro]|-cl)|pr|hyphena|flex-d)|(tab-|column(?!-s)|text-align-l)|(ap)|u|hy)/i.exec(t))?o[1]?1:o[2]?2:o[3]?3:5:0,c=(n=/^(?:(pos)|(cli)|(background-i)|(flex(?:$|-b)|(?:max-|min-)?(?:block-s|inl|he|widt))|dis)/i.exec(t))?n[1]?/^sti/i.test(r)?1:0:n[2]?/^pat/i.test(r)?1:0:n[3]?/^image-/i.test(r)?1:0:n[4]?"-"===r[3]?2:0:/^(?:inline-)?grid$/i.test(r)?4:0:0;for(let o of eS)s&o[1]&&(a+=e(o[0]+t,r,i)+";"),c&o[1]&&(a+=e(t,o[0]+r,i)+";");return a+e(t,r,i)}}),function({colors:e,disablePreflight:t}={}){return{preflight:t?void 0:eF,theme:{...eA,colors:{inherit:"inherit",current:"currentColor",transparent:"transparent",black:"#000",white:"#fff",...e}},variants:eZ,rules:eO,finalize:e=>e.n&&e.d&&e.r.some(e=>/^&::(before|after)$/.test(e))&&!/(^|;)content:/.test(e.d)?{...e,d:"content:var(--tw-content);"+e.d}:e}}({disablePreflight:!0})]}),"undefined"==typeof document?function(e){let t=[];return{target:t,snapshot(){let e=[...t];return()=>{t.splice(0,t.length,...e)}},clear(){t.length=0},destroy(){this.clear()},insert(e,r,i){t.splice(r,0,e)},resume:S}}():function(e){var t;let r;let i=e?.cssRules?e:(e&&"string"!=typeof e?e:(t=e,(r=document.querySelector(t||'style[data-twind=""]'))&&"STYLE"==r.tagName||(r=document.createElement("style"),document.head.prepend(r)),r.dataset.twind="claimed",r)).sheet;return{target:i,snapshot(){let e=Array.from(i.cssRules,e=>e.cssText);return()=>{this.clear(),e.forEach(this.insert)}},clear(){for(let e=i.cssRules.length;e--;)i.deleteRule(e)},destroy(){i.ownerNode?.remove()},insert(e,t){try{i.insertRule(e,t)}catch(e){i.insertRule(":root{}",t)}},resume:S}}("style[data-library]")),eq=e=>eJ(`!(${e})`);(function(e,...t){return("function"==typeof this?this:ev)(K(e,t))}).bind(eJ),(function(e,...t){("function"==typeof this?this:ev)(ei({"@layer base":ee(e,t)}))}).bind(eJ),ek.bind(eJ);let eG=ei`
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
`;function eY({size:e=o.md,mode:t=n.primary,shape:r=a.regular,classes:i,styles:l,children:s,onClick:c}){let d=ef({"border-none bg-primary text-primary-foreground shadow-default hover:opacity-70 focus:opacity-90":t===n.primary,"border-none bg-background text-foreground shadow-default hover:opacity-70 focus:opacity-90":t===n.secondary,"bg-transparent text-foreground border-transparent border-1 hover:border-light-gray":t===n.ghost}),u=ef({"rounded-default":r===a.regular,"rounded-full":r===a.icon}),f=ef({"text-xs":e===o.xs,"text-sm":e!==o.xs}),g=ef({"px-2 py-1":r===a.regular&&(e===o.xs||e===o.sm),"px-2.5 py-1.5":r===a.regular&&e===o.md,"px-3 py-2":r===a.regular&&e===o.lg,"px-3.5 py-2.5":r===a.regular&&e===o.xl,"p-1":r===a.icon&&e===o.xs,"p-1.5":r===a.icon&&e===o.sm,"p-2":r===a.icon&&e===o.md,"p-2.5":r===a.icon&&e===o.lg,"p-3":r===a.icon&&e===o.xl}),m=t===n.free?"":eq(ef("cursor-pointer","flex items-center justify-center font-semibold easy-in-out transition leading-none",d,u,f,g));return p`
    <button onClick="${()=>c()}" type="button" style="${l}" class="${m} ${i}">
      ${s}
    </button>
  `}(function(e){e.xs="xs",e.sm="sm",e.md="md",e.lg="lg",e.xl="xl"})(o||(o={})),function(e){e.primary="primary",e.secondary="secondary",e.ghost="ghost",e.free="free"}(n||(n={})),function(e){e.regular="regular",e.icon="icon"}(a||(a={}));var eX=r(2423);function eK(){g.tx.value=[]}function eQ(e){g.BC.value=e,g.tx.value=[...g.tx.value,e]}function e0({children:e,isActive:t,duration:r=300}){let[i,o]=(0,eX.eJ)(t),[n,a]=(0,eX.eJ)(t);if((0,eX.d4)(()=>{if(t)a(!0),globalThis.requestAnimationFrame(()=>o(!0));else{o(!1);let e=globalThis.setTimeout(()=>a(!1),r);return()=>globalThis.clearTimeout(e)}},[t,r]),!n)return null;let l={position:i?"relative":"absolute",inset:0,transition:`opacity ${r}ms ease, transform ${r}ms ease, position ${r}ms ease`,opacity:i?1:0};return p`<div style=${l}>${e}</div>`}function e1({currentRoute:e,pages:t,duration:r=300}){let i=Object.entries(t).map(([t,i])=>p`
      <${e0} id=${t} key=${t} isActive=${e===t} duration=${r}>
        <${i} />
      <//>
    `);return p`<div style=${{position:"relative",width:"100%",height:"100%"}}>${i}</div>`}let e2=(0,s.Fl)(()=>g.BC.value===f.dq.AUTH_OPTIONS?p`
      <${eY} onClick=${()=>void eQ(f.dq.HELP_PAGE)}
                 size="${o.md}"
                 mode="${n.ghost}"
                 shape="${a.icon}">
        <svg class="${eq("w-4 h-4")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM11 15H13V17H11V15ZM13 13.3551V14H11V12.5C11 11.9477 11.4477 11.5 12 11.5C12.8284 11.5 13.5 10.8284 13.5 10C13.5 9.17157 12.8284 8.5 12 8.5C11.2723 8.5 10.6656 9.01823 10.5288 9.70577L8.56731 9.31346C8.88637 7.70919 10.302 6.5 12 6.5C13.933 6.5 15.5 8.067 15.5 10C15.5 11.5855 14.4457 12.9248 13 13.3551Z"></path></svg>
      <//>
    `:g.tx.value.length<2?p``:p`
      <${eY} onClick=${()=>void function(){let e=g.tx.value;e.pop(),g.tx.value=e.slice(),g.BC.value=e[e.length-1]}()}
                 size="${o.md}"
                 mode="${n.ghost}"
                 shape="${a.icon}">
        
        <svg class="${eq("w-4 h-4")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7.82843 10.9999H20V12.9999H7.82843L13.1924 18.3638L11.7782 19.778L4 11.9999L11.7782 4.22168L13.1924 5.63589L7.82843 10.9999Z"></path></svg>
      <//>
    `);function e5(){return p`
    <header class="${eq("flex items-center px-3 py-2")}">
      <div class="${eq("w-3/12 flex justify-start")}">
        ${e2.value}
      </div>

      <div class="${eq("w-6/12 text-center")}">
        <h1 class="${eq("text-foreground-strong font-semibold")}">
          ${g.d$.value}
        </h1>
      </div>

      <div class="${eq("w-3/12 flex justify-end")}">
        <${eY} onClick=${()=>m.Nv.next()}
                   size="${o.md}"
                   mode="${n.ghost}"
                   shape="${a.icon}">

          <svg class="${eq("w-4 h-4")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"></path></svg>
        <//>
      </div>
    </header>
  `}function e9(){return p`
    <footer class="${eq("w-full text-center p-2 border-t-1 border-t-border")}">
      <p class="${eq("text-xs text-foreground")}">
        Powered by
        <a target="_blank" href="https://stellarwalletskit.dev/" class="${eq("font-semibold underline ml-1")}">
          Stellar Wallets Kit
        </a>
      </p>
    </footer>
  `}function e4(e){return p`
    <img alt="${e.alt}" src="${e.image}" class="${eq(ef("inline-block rounded-full outline -outline-offset-1 outline-black/5 dark:outline-white/10",e.size))}" />
  `}!function(e){e.xs="w-6 h-6",e.sm="w-8 h-8",e.md="w-10 h-10",e.lg="w-12 h-12",e.xl="w-14 h-14"}(l||(l={}));let e3=(0,s.Fl)(()=>{let e;let t=g.oO.value.reduce((e,t)=>({available:t.isAvailable?[...e.available,t]:e.available,unavailable:t.isAvailable?e.unavailable:[...e.unavailable,t]}),{available:[],unavailable:[]});try{let t=globalThis?.localStorage.getItem(f.dR.usedWalletsIds);e=t?JSON.parse(t):[]}catch(t){console.error(t),e=[]}let r=[],i=[];for(let o of t.available)e.find(e=>e===o.id)?r.push(o):i.push(o);return[...r.sort((t,r)=>e.indexOf(t.id)-e.indexOf(r.id)),...i,...t.unavailable]});async function e8(e){if(!e.isAvailable){globalThis.open(e.url,"_blank");return}if(g.F5.value=e.id,m.et.next(e),e.type===f.PO.HW_WALLET)eQ(f.dq.HW_ACCOUNTS_FETCHER);else try{let{address:e}=await g.yZ.value.getAddress();g.Lt.value=e,m.py.next(e)}catch(e){m.py.next(e)}}var e6=r(6236);let e7=(0,s.td)(!1);function te(){if(!g.Lt.value)throw Error("Text to copy to the clipboard can't be undefined");navigator.clipboard.writeText(g.Lt.value).then(()=>{e7.value=!0,setTimeout(()=>{e7.value=!1},2500)}).catch(e=>console.error(e))}let tt={error:null,loading:!0,accounts:[]};class tr extends c.wA{constructor(){super(...arguments),Object.defineProperty(this,"stateSignal",{enumerable:!0,configurable:!0,writable:!0,value:(0,s.td)(tt)})}componentWillMount(){g.d$.value="Wallet Accounts",this.fetchAccounts()}async fetchAccounts(){let e=g.yZ.value;this.stateSignal.value=tt,e.disconnect&&(await e.disconnect(),await new Promise(e=>setTimeout(e,500)));try{let t=await e.getAddresses();this.stateSignal.value={...this.stateSignal.value,loading:!1,accounts:t}}catch(e){this.stateSignal.value={...this.stateSignal.value,error:e.message}}}async selectAccount(e){g.Lt.value=e.publicKey,m.py.next(e.publicKey)}render(){let e=p`
      <div class="${eq("py-8 w-full flex justify-center items-center text-foreground")}">
        <svg class="${eq("w-8 h-8 text-gray-200 animate-spin")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3C16.9706 3 21 7.02944 21 12H19C19 8.13401 15.866 5 12 5V3Z"></path>
        </svg>
      </div>
    `,t=p`    
      <ul class="${eq("w-full grid gap-2 px-2 py-4 text-foreground")}">
        ${g.ei.value.map(({publicKey:e,index:t})=>p`
            <li onClick=${()=>this.selectAccount({publicKey:e,index:t})}
                class="${eq("px-2 py-2 cursor-pointer flex justify-between items-center bg-background hover:border-light-gray border-1 border-transparent rounded-default duration-150 ease active:bg-background active:border-gray")}">
              ${e.slice(0,6)}....${e.slice(-6)}

              <span class="dialog-text">(44'/148'/${t}')</span>
            </li>
          `)}
      </ul>
    `,r=p`
      <div class="${eq("w-full text-center text-foreground py-4")}">
        <div class="${eq("text-danger")}">
          <svg class="${eq("inline-block mx-auto w-8 h-8 mb-2")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.8659 3.00017L22.3922 19.5002C22.6684 19.9785 22.5045 20.5901 22.0262 20.8662C21.8742 20.954 21.7017 21.0002 21.5262 21.0002H2.47363C1.92135 21.0002 1.47363 20.5525 1.47363 20.0002C1.47363 19.8246 1.51984 19.6522 1.60761 19.5002L11.1339 3.00017C11.41 2.52187 12.0216 2.358 12.4999 2.63414C12.6519 2.72191 12.7782 2.84815 12.8659 3.00017ZM4.20568 19.0002H19.7941L11.9999 5.50017L4.20568 19.0002ZM10.9999 16.0002H12.9999V18.0002H10.9999V16.0002ZM10.9999 9.00017H12.9999V14.0002H10.9999V9.00017Z"></path>
          </svg>
        </div>
        
        <h3 class="${eq("text-sm font-semibold")}">
          Error while fetching accounts with reason:
        </h3>
        
        <p class="${eq("mb-4 text-sm")}">
          ${this.stateSignal.value.error}
        </p>
        
        <div class="${eq("w-full flex justify-center items-center")}">
          <${eY} onClick=${()=>this.fetchAccounts()} size="${o.md}">
            Retry
          <//>
        </div>
      </div>
    `;return this.stateSignal.value.error?r:this.stateSignal.value.loading?e:t}}let ti={[f.dq.AUTH_OPTIONS]:function(){g.d$.value="Connect Wallet";let e=e3.value.find(e=>e.isPlatformWrapper);if(e)return e8(e).then(),p`
      <div class="${eq("w-full text-center px-4 py-8")}">
        <div class="${eq("w-full mb-4")}">
          <${e4} alt="${e.name} icon" image="${e.icon}" size="${l.md}" />
        </div>

        <p class="${eq("text-foreground text-lg w-full")}">
          Connecting to your wallet using <b>${e.name}</b>
        </p>
      </div>
    `;let t=p`
    <div class="${eq("w-full text-center text-foreground font-semibold p-4")}">Loading wallets...</div>
  `,r=e3.value.map(e=>p`
      <li
        onClick="${()=>e8(e)}"
        class="${eq("px-2 py-2 cursor-pointer flex justify-between items-center bg-background hover:border-light-gray border-1 border-transparent rounded-default duration-150 ease active:bg-background active:border-gray")}"
      >
        <div class="${eq("flex items-center gap-2")}">
          <${e4} class="${eq("mr-2")}" alt="${e.name} icon" image="${e.icon}" size="${l.sm}" />
          <p class="${eq("text-foreground font-semibold")}">${e.name}</p>
        </div>

        ${g.Xk.value&&!e.isAvailable?p`
            <div class="${eq("ml-4 flex items-center")}">
              <small
                class="${eq("inline-flex items-center border-1 border-border px-2 py-1 rounded-default text-foreground-secondary text-xs bg-background-secondary")}"
              >
                ${g.AL.value}

                <svg class="${eq("w-4 h-4")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.0037 9.41421L7.39712 18.0208L5.98291 16.6066L14.5895 8H7.00373V6H18.0037V17H16.0037V9.41421Z"></path>
                </svg>
              </small>
            </div>
          `:""}
      </li>
    `);return p`
    <ul class="${eq("w-full grid gap-2 px-2 py-4")}">
      ${0===e3.value.length?t:r}
    </ul>
  `},[f.dq.HELP_PAGE]:function(){return p`
    <section class="${eq("w-full p-4 pb-8 rounded-tl-default")}">
      <div class="${eq("w-full mb-6")}">
        <h3 class="${eq("text-foreground-strong font-semibold text-lg mb-2")}">What is a wallet?</h3>
        <p class="${eq("text-foreground text-sm")}">
          Wallets are used to send, receive, and store the keys you use to sign blockchain transactions.
        </p>
      </div>

      <div class="w-full">
        <h3 class="${eq("text-foreground-strong font-semibold text-lg mb-2")}">What is Stellar?</h3>
        <p class="${eq("text-foreground text-sm")}">
          Stellar is a decentralized, public blockchain that gives developers the tools to create experiences that are more
          like cash than crypto.
        </p>
      </div>
    </section>
  `},[f.dq.PROFILE_PAGE]:function(){return g.d$.value="",p`
    <section class="${eq("w-full flex flex-col pb-8")}">
      <div class="${eq("w-full flex justify-center mb-4")}">
        <${e4} alt="${g.yZ.value?.productName} icon" image="${g.yZ.value?.productIcon}" size="${l.xl}" />
      </div>
      
      <div class="${eq("w-full flex items-center justify-center mb-2")}">
        <h1 class="${eq("text-lg font-semibold text-foreground")}">
          ${g.Lt.value&&`${g.Lt.value.slice(0,6)}....${g.Lt.value.slice(-6)}`}
        </h1>
      </div>
      
      <div class="${eq("w-full flex flex-col items-center justify-center gap-2")}">
        <${eY} mode="${n.ghost}" onClick="${te}" size="${o.sm}">
          ${e7.value?"Address copied!":p`Copy address`} <svg class="${eq("w-4 h-4 ml-2")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6.9998 6V3C6.9998 2.44772 7.44752 2 7.9998 2H19.9998C20.5521 2 20.9998 2.44772 20.9998 3V17C20.9998 17.5523 20.5521 18 19.9998 18H16.9998V20.9991C16.9998 21.5519 16.5499 22 15.993 22H4.00666C3.45059 22 3 21.5554 3 20.9991L3.0026 7.00087C3.0027 6.44811 3.45264 6 4.00942 6H6.9998ZM5.00242 8L5.00019 20H14.9998V8H5.00242ZM8.9998 6H16.9998V16H18.9998V4H8.9998V6Z"></path></svg>
        <//>

        <${eY} mode="${n.ghost}" onClick="${e6.z}" size="${o.sm}">
          Disconnect <svg class="${eq("w-4 h-4 ml-2")}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 11H13V13H5V16L0 12L5 8V11ZM3.99927 18H6.70835C8.11862 19.2447 9.97111 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C9.97111 4 8.11862 4.75527 6.70835 6H3.99927C5.82368 3.57111 8.72836 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C8.72836 22 5.82368 20.4289 3.99927 18Z"></path></svg>
        <//>
      </div>
    </section>
  `},[f.dq.HW_ACCOUNTS_FETCHER]:tr},to=ei`
  .glass {
    backdrop-filter: blur(10px);
    background-color: color-mix(in srgb, var(--swk-background) 25%, transparent);
  }
`;function tn(){let e=eq(ef([g.xJ.value===f.dx.FIXED?"fixed flex left-0 top-0 z-[999] w-full h-full":"inline-flex","font-default justify-center items-center"]));return p`
    <section class="stellar-wallets-kit ${e} ${eq(eG)} ${eq(to)}">
      ${g.xJ.value===f.dx.FIXED?p`
          <div class="${eq("absolute left-0 top-0 z-0 w-full h-full bg-[rgba(0,0,0,0.5)]")}" onClick="${()=>m.Nv.next()}"></div>
        `:""}

      <section
        class="${eq("w-full h-fit relative max-w-[22rem] max-h-[39.4375rem] grid grid-cols-1 grid-rows-[auto_1fr_auto] bg-background rounded-default shadow-default transition-all duration-[0.5s] ease-in-out overflow-hidden max-h-[400px] overflow-y-scroll")}"
      >
        <div class="${eq("col-span-1 top-0 sticky z-50")} glass">
          <${e5} />
        </div>

        <div class="${eq("col-span-1 relative z-10")}">
          <${e1}
            currentRoute="${g.BC.value}"
            pages="${ti}"
            duration="${400}"
          />
        </div>

        <div class="${eq("col-span-1 bottom-0 sticky z-50")} glass">
          <${e9} />
        </div>
      </section>
    </section>
  `}async function ta(e){if(e&&e(),void 0===g.yF.value)throw Error("The kit hasn't been initiated.");g.yZ.value&&g.Lt.value?await ts.profileModal():await ts.authModal()}function tl(e){let t=g.Lt.value?`${g.Lt.value.slice(0,4)}....${g.Lt.value.slice(-6)}`:"Connect Wallet";return p`
    <div class="${eq(eG)} ${eq("inline-block")}">      
      <${eY} styles=${e.styles} 
                 classes=${e.classes}
                 mode=${e.mode||n.primary}
                 shape=${e.shape||a.regular}
                 size=${e.size}
                 onClick=${()=>ta(e.onClick)}>        
        ${e.children?e.children:t}
      <//>
    </div>
  `}class ts{static init(e){g.yF.value=e.modules,e.selectedWalletId&&ts.setWallet(e.selectedWalletId),e.network&&ts.setNetwork(e.network),e.theme&&ts.setTheme(e.theme),e.authModal&&(void 0!==e.authModal.showInstallLabel&&(g.Xk.value=e.authModal.showInstallLabel),void 0!==e.authModal.hideUnsupportedWallets&&(g.Qb.value=e.authModal.hideUnsupportedWallets))}static get selectedModule(){if(!g.yZ.value)throw{code:-3,message:"Please set the wallet first"};return g.yZ.value}static setWallet(e){let t=g.yF.value.find(t=>t.productId===e);if(!t)throw Error(`Wallet id "${e}" is not and existing module`);g.F5.value=t.productId}static setNetwork(e){g.fr.value=e}static setTheme(e=f.bh){g.rS.value=e}static async getAddress(){if(!g.Lt.value)throw{code:-1,message:"No wallet has been connected."};return{address:g.Lt.value}}static signTransaction(e,t){return ts.selectedModule.signTransaction(e,{...t,networkPassphrase:t?.networkPassphrase||g.fr.value})}static signAuthEntry(e,t){return ts.selectedModule.signAuthEntry(e,{...t,networkPassphrase:t?.networkPassphrase||g.fr.value})}static signMessage(e,t){return ts.selectedModule.signMessage(e,{...t,networkPassphrase:t?.networkPassphrase||g.fr.value})}static getNetwork(){return ts.selectedModule.getNetwork()}static async disconnect(){(0,e6.z)()}static on(e,t){switch(e){case f.O9.STATE_UPDATED:{let e,r;return(0,s.cE)(()=>{(g.Lt.value!==e||g.fr.value!==r)&&(e=g.Lt.value,r=g.fr.value,t({eventType:f.O9.STATE_UPDATED,payload:{address:g.Lt.value,networkPassphrase:g.fr.value}}))})}case f.O9.WALLET_SELECTED:{let e;return(0,s.cE)(()=>{g.F5.value!==e&&(e=g.F5.value,t({eventType:f.O9.WALLET_SELECTED,payload:{id:g.F5.value}}))})}case f.O9.DISCONNECT:return m.Fz.subscribe(()=>{t({eventType:f.O9.DISCONNECT,payload:{}})});default:throw Error(`${e} event type is not supported`)}}static async refreshSupportedWallets(){let e=await Promise.all(g.yF.value.map(async e=>{let t=new Promise(e=>setTimeout(()=>e(!1),1e3));return{id:e.productId,name:e.productName,type:e.moduleType,icon:e.productIcon,isAvailable:await Promise.race([t,e.isAvailable()]).catch(()=>!1),isPlatformWrapper:await Promise.race([t,e.isPlatformWrapper?e.isPlatformWrapper():Promise.resolve(!1)]).catch(()=>!1),url:e.productUrl}}));return g.oO.value=e,e}static async createButton(e,t={}){(0,c.sY)(p`
        <${tl}
          styles="${t.styles}"
          classes="${t.classes}"
          mode="${t.mode}"
          shape="${t.shape}"
          size="${t.size}"
          onClick="${()=>t.onClick&&t.onClick()}"
          children="${t.children}"
        />
      `,e)}static async authModal(e){eK(),eQ(f.dq.AUTH_OPTIONS),g.xJ.value=e?.container?f.dx.BLOCK:f.dx.FIXED;let t=document.createElement("div");(e?.container||document.body).appendChild(t),(0,c.sY)(p`
        <${tn} />
      `,t),await ts.refreshSupportedWallets();let r=[],i=()=>{for(let e of r)e();(0,c.sY)(null,t),t.parentNode?.removeChild(t)};return new Promise((e,t)=>{let i=m.py.subscribe(r=>{"string"==typeof r?e({address:r}):t((0,e6.n)(r))}),o=m.Nv.subscribe(()=>{t({code:-1,message:"The user closed the modal."})});r.push(i),r.push(o)}).then(e=>(i(),e)).catch(e=>{throw i(),e})}static async profileModal(e){if(!g.Lt.value)throw{code:-1,message:"There is no active address, the user needs to authenticate first."};eK(),eQ(f.dq.PROFILE_PAGE),g.xJ.value=e?.container?f.dx.BLOCK:f.dx.FIXED;let t=document.createElement("div");(e?.container||document.body).appendChild(t),(0,c.sY)(p`
        <${tn} />
      `,t);let r=m.Nv.subscribe(()=>{r(),(0,c.sY)(null,t),t.parentNode?.removeChild(t)})}}}};