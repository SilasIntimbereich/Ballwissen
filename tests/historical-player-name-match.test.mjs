import test from "node:test";
import assert from "node:assert/strict";
import { namesMatch } from "../scripts/historical-player-name-match.mjs";

test("matches hyphenated names against unhyphenated FIFA display fields", () => {
  assert.equal(namesMatch("Kim Min-jae", "KIM Minjae Minjae KIM M J KIM"), true);
  assert.equal(namesMatch("Moussa N'Diaye", "NDIAYE Moussa Moussa NDIAYE M. NDIAYE"), true);
});

test("repairs the null-character ligature artifact in PDF text extraction", () => {
  assert.equal(namesMatch("Sofiane Boufal", "BOUFAL So\u0000ane So\u0000ane BOUFAL"), true);
  assert.equal(namesMatch("Daniel-Kofi Kyereh", "KYEREH Daniel-Ko\u0000 Daniel Ko\u0000 KYEREH"), true);
});

test("does not silently accept a nickname or a different first name", () => {
  assert.equal(namesMatch("Papu Gómez", "GOMEZ Alejandro Alejandro Dario GÓMEZ GÓMEZ"), false);
  assert.equal(namesMatch("Sebas Méndez", "MENDEZ Jhegson Jhegson Sebastián MÉNDEZ CARABALÍ MENDEZ"), false);
});

test("normalizes Nordic and Polish romanization and splits hyphenated names", () => {
  assert.equal(namesMatch("Simon Kjær", "KJAER Simon Simon Thorup KJÆR KJÆR"), true);
  assert.equal(namesMatch("Christian Nørgaard", "NORGAARD Christian Christian Thers NØRGAARD NØRGAARD"), true);
  assert.equal(namesMatch("Przemysław Frankowski", "FRANKOWSKI Przemyslaw Przemysław Adam FRANKOWSKI"), true);
  assert.equal(namesMatch("Jean-Pierre Nsame", "NSAME Jean-Pierre Jean Pierre Junior NSAME"), true);
  assert.equal(namesMatch("Cameron Carter-Vickers", "CARTER-VICKERS Cameron Cameron Robert CARTER-VICKERS"), true);
});

test("accepts explicitly reviewed FIFA display-name variants from the 2006 squad list", () => {
  assert.equal(namesMatch("Juan Pablo Sorín", "Juan SORIN"), true);
  assert.equal(namesMatch("Juan Román Riquelme", "Juan RIQUELME"), true);
  assert.equal(namesMatch("Leo Franco", "Leonardo FRANCO"), true);
  assert.equal(namesMatch("Lucho González", "Luis GONZALEZ"), true);
});

test("normalizes Turkish dotless i in FIFA display names", () => {
  assert.equal(namesMatch("Kenan Yıldız", "YILDIZ Kenan Kenan YILDIZ YILDIZ"), true);
  assert.equal(namesMatch("Altay Bayındır", "BAYINDIR Altay Altay BAYINDIR ALTAY"), true);
  assert.equal(namesMatch("Ferdi Kadıoğlu", "KADIOGLU Ferdi Ferdi Erenay KADIOĞLU F. KADIOĞLU"), true);
});


test("does not approve ambiguous short single-token names from a longer source line", () => {
  assert.equal(namesMatch("Li", "LI Weifeng"), false);
  assert.equal(namesMatch("Li", "Li"), true);
  assert.equal(namesMatch("Kaka", "KAKA Ricardo Izecson dos Santos Leite"), true);
});
