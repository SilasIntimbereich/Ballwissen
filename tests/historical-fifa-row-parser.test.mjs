import test from "node:test";
import assert from "node:assert/strict";
import {parseRows,parseColumnarRows} from "../scripts/historical-fifa-row-parser.mjs";

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

test("parses rows when PDF extraction drops the hash and pipe markers",()=>{
 const first="1 FIFA Display Name Nahuel GUZMAN Last Name GUZMAN First Name Nahuel Ignacio Shirt Name GUZMAN DOB 10.02.1986 POS GK Club Tigres (MEX) Height 192";
 const second="2 FIFA Display Name Gabriel MERCADO Last Name MERCADO First Name Gabriel Ivan Shirt Name MERCADO DOB 18.03.1987 POS DF Club Sevilla FC (ESP) Height 181";
 const rows=parseRows(["# FIFA Display Name Last Name First Name Shirt Name DOB POS Club Height",first,second],"2018");
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(row=>row.number),[1,2]);
 assert.deepEqual(rows.map(row=>row.nameArea),["Nahuel GUZMAN","Gabriel MERCADO"]);
 assert.deepEqual(rows.map(row=>row.position),["GK","DF"]);
});

test("parses FIFA column-oriented squad pages using aligned field cells",()=>{
 const group=(label,values)=>({items:[{x:0,text:label},...values.map((text,index)=>({x:100+index*50,text}))]});
 const groups=[
  group("Club",["Tigres (MEX)","Sevilla FC (ESP)","Ajax (NED)"]),
  group("POS",["GK","DF","MF"]),
  group("DOB",["10.02.1986","18.03.1987","31.08.1992"]),
  group("FIFA Display Name",["Nahuel GUZMAN","Gabriel MERCADO","Nicolas TAGLIAFICO"])
 ];
 const rows=parseColumnarRows(groups,["# 1 2","3"]);
 assert.equal(rows.length,3);
 assert.deepEqual(rows.map(row=>row.number),[1,2,3]);
 assert.deepEqual(rows.map(row=>row.nameArea),["Nahuel GUZMAN","Gabriel MERCADO","Nicolas TAGLIAFICO"]);
 assert.deepEqual(rows.map(row=>row.position),["GK","DF","MF"]);
 assert.deepEqual(rows.map(row=>row.club),["Tigres","Sevilla FC","Ajax"]);
});

test("parses FIFA column labels split across separate PDF text items",()=>{
 const groups=[
  {items:[{x:0,text:"FIFA"},{x:30,text:"Display"},{x:70,text:"Name"},{x:120,text:"Hugo LLORIS"},{x:220,text:"Olivier GIROUD"}]},
  {items:[{x:0,text:"POS"},{x:50,text:"GK"},{x:100,text:"FW"}]},
  {items:[{x:0,text:"DOB"},{x:50,text:"26.12.1986"},{x:100,text:"30.09.1986"}]},
  {items:[{x:0,text:"Club"},{x:50,text:"Tottenham Hotspur (ENG)"},{x:100,text:"Chelsea FC (ENG)"}]}
 ];
 const rows=parseColumnarRows(groups,["# 1 2"]);
 assert.deepEqual(rows.map(row=>row.nameArea),["Hugo LLORIS","Olivier GIROUD"]);
 assert.deepEqual(rows.map(row=>row.position),["GK","FW"]);
});

test("parses FIFA 2014 row-oriented PDF extraction with all player fields",()=>{
 const lines=[
  "1 Cedric SI MOHAMMED SI MOHAMMED Cédric SI MOHAMMED 09.01.1985 GK CS Constantine (ALG) 182 1 0",
  "2 Madjid BOUGUERRA BOUGUERRA Madjid BOUGUERRA 07.10.1982 DF Lekhwiya SC (QAT) 189 62 4",
  "3 Faouzi GHOULAM GHOULAM Faouzi GHOULAM 01.02.1991 DF SSC Napoli (ITA) 184 6 0"
 ];
 const rows=parseRows(lines,"2014");
 assert.equal(rows.length,3);
 assert.deepEqual(rows.map(row=>row.number),[1,2,3]);
 assert.deepEqual(rows.map(row=>row.position),["GK","DF","DF"]);
 assert.deepEqual(rows.map(row=>row.club),["CS Constantine","Lekhwiya SC","SSC Napoli"]);
 assert.equal(rows[0].nameArea,"Cedric SI MOHAMMED SI MOHAMMED Cédric SI MOHAMMED");
});
