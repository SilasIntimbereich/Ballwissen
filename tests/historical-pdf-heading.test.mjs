import test from "node:test";
import assert from "node:assert/strict";
import {extractTeamHeading} from "../scripts/historical-pdf-heading.mjs";

test("extracts a country-code heading from Qatar 2022 FIFA pages",()=>{
 assert.equal(extractTeamHeading(["FIFA World Cup Qatar 2022","SQUAD LIST","Argentina (ARG)","# POS NAME DOB CLUB"],["Argentina"]),"Argentina (ARG)");
});

test("supports FIFA's country display aliases when the code is correct",()=>{
 assert.equal(extractTeamHeading(["IR Iran (IRN)","SQUAD LIST"],["Iran"]),"IR Iran (IRN)");
 assert.equal(extractTeamHeading(["Korea Republic (KOR)","SQUAD LIST"],["South Korea"]),"Korea Republic (KOR)");
 assert.equal(extractTeamHeading(["Korea DPR (PRK)","SQUAD LIST"],["North Korea"]),"Korea DPR (PRK)");
});

test("rejects a known country paired with another country's FIFA code",()=>{
 assert.equal(extractTeamHeading(["Argentina (BRA)","SQUAD LIST"],["Argentina"]),"");
});

test("supports older FIFA pages with List of Players followed by a country",()=>{
 assert.equal(extractTeamHeading(["FIFA World Cup South Africa 2010","List of Players","South Africa","# Position Player Club"],["South Africa"]),"South Africa");
});

test("does not mistake generic PDF labels or table headings for a country",()=>{
 assert.equal(extractTeamHeading(["FIFA World Cup Qatar 2022","SQUAD LIST","POS","PLAYER","DOB"],["Argentina","Brazil"]),"");
});

test("does not mistake a country mentioned in the body for the page heading",()=>{
 assert.equal(extractTeamHeading(["FIFA World Cup Qatar 2022","SQUAD LIST","PLAYER","DOB","CLUB","Coach","Official match details","Argentina"],["Argentina"]),"");
});

test("fails closed when a page has unrelated headings or an unknown country code",()=>{
 assert.equal(extractTeamHeading(["Official tournament document","SQUAD LIST","Player information"],["Argentina","Brazil"]),"");
 assert.equal(extractTeamHeading(["Atlantis (ATL)","SQUAD LIST"],["Argentina","Brazil"]),"");
});
