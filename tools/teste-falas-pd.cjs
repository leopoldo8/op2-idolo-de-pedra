const path = require("node:path");
const F = require(path.join(__dirname, "..", "painel-do-mestre", "falas-pd.js"));

let failures = 0;
function check(label, ok) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
}

check("above half is alto", F.tierFor(14, 16) === "alto");
check("half is baixo", F.tierFor(8, 16) === "baixo");
check("3 or less is limite", F.tierFor(3, 16) === "limite");
check("0 is zero", F.tierFor(0, 16) === "zero");
for (const id of ["alan", "victor", "eloisa", "edgar"]) {
  for (const tier of ["alto", "baixo", "limite", "zero"]) {
    check(`${id} has ${tier} lines`, Array.isArray(F.LINES[id][tier]) && F.LINES[id][tier].length >= 2);
  }
}
const first = F.pickLine("eloisa", 12, 14, 0);
const second = F.pickLine("eloisa", 12, 14, 1);
check("lines rotate within a tier", first.tier === "alto" && first.text !== second.text);
check("unknown character returns null", F.pickLine("kenia", 5, 12, 0) === null);
const all = Object.values(F.LINES).flatMap((byTier) => Object.values(byTier).flat());
check("no em dashes in lines", all.every((line) => !/[—–]/.test(line)));

console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
