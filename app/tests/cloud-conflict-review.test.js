import assert from "node:assert/strict";
import { compareCloudStates, cloudConflictReviewText } from "../cloudConflictReview.js";

const local = {
  ingredients: [
    { id:"a", name:"Ingrediente local", qty:2 },
    { id:"b", name:"Otro ingrediente", qty:4 }
  ],
  familyMembers:[{ id:"family-1", name:"Nombre personal no publicable" }],
  nutritionProfiles:[{ id:"p1", privateHealth:"Información de salud no publicable" }],
  settings:{ calendarView:"week" }
};
const remote = {
  ingredients:[
    { qty:3, name:"Ingrediente local", id:"a" },
    { id:"c", name:"Añadido en otro dispositivo", qty:1 }
  ],
  familyMembers:[{ name:"Nombre personal no publicable", id:"family-1" }],
  nutritionProfiles:[{ id:"p1", privateHealth:"Información de salud no publicable" }],
  settings:{ calendarView:"month" }
};

const comparison = compareCloudStates(local, remote);
assert.equal(comparison.hasDifferences, true);
assert.equal(comparison.differences.length, 1);
assert.deepEqual(comparison.differences[0], {
  key:"ingredients",
  label:"Ingredientes",
  localCount:2,
  remoteCount:2,
  onlyLocal:1,
  onlyRemote:1,
  different:1
});
assert.equal(comparison.otherSettingsChanged, 1);

const publicReport = cloudConflictReviewText({
  ...comparison,
  knownUpdatedAt:"2026-10-12T08:00:00Z",
  remoteUpdatedAt:"2026-10-12T09:00:00Z",
  pendingLocalChanges:true
});
assert.match(publicReport, /Ingredientes: local 2, nube 2/);
assert.match(publicReport, /cambios locales pendientes/i);
for (const forbidden of ["Nombre personal", "Información de salud", "Ingrediente local", "family-1", "p1"]) {
  assert.ok(!publicReport.includes(forbidden), "the preview must not reveal field values or record IDs");
}

const sameWithDifferentObjectKeyOrder = compareCloudStates(
  { ingredients:[{ id:"a", name:"X", qty:3 }] },
  { ingredients:[{ qty:3, id:"a", name:"X" }] }
);
assert.equal(sameWithDifferentObjectKeyOrder.hasDifferences, false);
console.log("cloud-conflict-review.test.js OK");
