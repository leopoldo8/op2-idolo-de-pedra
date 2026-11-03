const path = require("node:path");
global.window = {};
require(path.join(__dirname, "..", "painel-do-mestre", "stage.js"));
const S = window.Stage;

let failures = 0;
function check(label, ok, extra) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${extra !== undefined ? `: ${extra}` : ""}`);
}

const normal = S.tokensHtml({ style: "corpo", size: 1, tokens: [{ id: "alan", name: "Alan", status: "ativo", x: 50, y: 27 }] }, false);
check("normal token renders", normal.includes('data-token="alan"') && normal.includes("left:50%") && normal.includes("st-ativo"));

const evil = S.tokensHtml({
  style: '"><img src=x onerror=alert(1)>',
  size: "1;background:url(x)",
  tokens: [{ id: 'x" onmouseover="alert(1)', name: "<img src=x onerror=alert(1)>", status: '"><script>', x: "1%;}</style><script>", y: 2, fixedStyle: '"><b>' }]
}, false);
const tags = evil.match(/<[a-z]+/gi) || [];
check("hostile values open no extra tags", JSON.stringify(tags) === JSON.stringify(["<div", "<img", "<span"]), JSON.stringify(tags));
const outsideText = evil.replace(/<span>[\s\S]*<\/span>/, "");
check("hostile values add no attributes", !/\son[a-z]+\s*=|<script/i.test(outsideText), outsideText);
check("non-numeric coordinates fall back to numbers", evil.includes("left:50%") && evil.includes("--s:1;"), evil);

console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
