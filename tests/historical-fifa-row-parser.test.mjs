import test from "node:test";
import assert from "node:assert/strict";
import {parseRows} from "../scripts/historical-fifa-row-parser.mjs";

const row2018="# 1 | FIFA Display Name Hugo LLORIS | Last Name LLORIS | First Name Hugo | Shirt Name LLORIS | DOB 26.12.1986 | POS GK | Club Tottenham Hotspur (ENG) | Height 188";
const row2014="# 2 | FIFA Display Name Dani ALVES | Last Name ALVES DA SILVA | First Name Daniel | Shirt Name DANI ALVES | DOB 06.05.1983 | POS DF | Club FC Barcelona (ESP) | Height 175 | Caps 79 | Goals 6";

test("parses FIFA 2018 labelled squad rows",()=>{
 const rows=parseRows([row2018],"modern-pipe");
 assert.equal(rows.length,1);
 assert.deepEqual({number:rows[0].number,position:rows[0].position,name:rows[0].nameArea,club:rows[0].club},
  {number:1,position:"GK",name:"Hugo LLORIS",club:"Tottenham Hotspur"});
});

test("parses FIFA 2014 labelled rows including trailing caps and goals",()=>{
 const rows=parseRows([row2014],"modern-pipe");
 assert.equal(rows.length,1);
 assert.deepEqual({number:rows[0].number,position:rows[0].position,name:rows[0].nameArea,club:rows[0].club},
  {number:2,position:"DF",name:"Dani ALVES",club:"FC Barcelona"});
});

test("parses multiple rows when PDF extraction removes visual pipe separators",()=>{
 const first="# 1 FIFA Display Name Mathew RYAN Last Name RYAN First Name Mathew David Shirt Name RYAN DOB 08.04.1992 POS GK Club Brighton (ENG) Height 184";
 const second="# 2 FIFA Display Name Milos DEGENEK Last Name DEGENEK First Name Milos Shirt Name DEGENEK DOB 28.04.1994 POS DF Club Yokohama F Marinos (JPN) Height 187";
 const rows=parseRows([first,second],"modern-pipe");
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(row=>row.number),[1,2]);
 assert.deepEqual(rows.map(row=>row.position),["GK","DF"]);
 assert.deepEqual(rows.map(row=>row.club),["Brighton","Yokohama F Marinos"]);
});

test("does not create a player from incomplete or coach records",()=>{
 const rows=parseRows(["# Coach: Jorge SAMPAOLI (ARG)"," # 24 | FIFA Display Name Incomplete | Last Name Incomplete"],"modern-pipe");
 assert.equal(rows.length,0);
});
