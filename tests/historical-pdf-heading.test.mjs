import test from "node:test";
import assert from "node:assert/strict";
import {extractTeamHeading} from "../scripts/historical-pdf-heading.mjs";

test("extracts a country-code heading from Qatar 2022 FIFA pages",()=>{
 assert.equal(extractTeamHeading(["FIFA World Cup Qatar 2022","SQUAD LIST","Argentina (ARG)","# POS NAME DOB CLUB"],["Argentina"]),"Argentina (ARG)");
});

test("supports older FIFA pages with List of Players followed by a country",()=>{
 assert.equal(extractTeamHeading(["FIFA World Cup South Africa 2010","List of Players","South Africa","# Position Player Club"],["South Africa"]),"South Africa");
});

test("does not mistake generic PDF labels or table headings for a country",()=>{
 assert.equal(extractTeamHeading(["FIFA World Cup Qatar 2022","SQUAD LIST","POS","PLAYER","DOB"],["Argentina","Brazil"]),"");
});

test("fails closed when a page has unrelated headings or an unknown country code",()=>{
 assert.equal(extractTeamHeading(["Official tournament document","SQUAD LIST","Player information"],["Argentina","Brazil"]),"");
 assert.equal(extractTeamHeading(["Atlantis (ATL)","SQUAD LIST"],["Argentina","Brazil"]),"");
});
