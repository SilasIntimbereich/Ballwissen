import test from "node:test";
import assert from "node:assert/strict";
import {hasIndependentHttpsSources,normalizeHttpsHost} from "../scripts/source-url-validation.mjs";

test("normalizes www and subdomains to the same registrable publisher domain",()=>{
 assert.equal(normalizeHttpsHost("https://www.fifa.com/squad.pdf"),"fifa");
 assert.equal(normalizeHttpsHost("https://data.fifa.com/other.pdf"),"fifa");
 assert.equal(hasIndependentHttpsSources(["https://www.fifa.com/squad.pdf","https://data.fifa.com/other.pdf"]),false);
});

test("recognizes FIFA-owned mirror domains as one publisher",()=>{
 assert.equal(normalizeHttpsHost("https://fifadata.com/squad.pdf"),"fifa");
 assert.equal(normalizeHttpsHost("https://fdp.fifa.org/asset.pdf"),"fifa");
 assert.equal(hasIndependentHttpsSources(["https://fifadata.com/squad.pdf","https://fdp.fifa.org/asset.pdf"]),false);
});

test("does not count an archived copy as an independent publisher",()=>{
 assert.equal(normalizeHttpsHost("https://web.archive.org/web/20100616010702id_/http://www.fifa.com/squad.pdf"),"fifa");
 assert.equal(hasIndependentHttpsSources(["https://www.fifa.com/squad.pdf","https://web.archive.org/web/20100616010702id_/http://www.fifa.com/squad.pdf"]),false);
});

test("rejects malformed archive wrappers instead of counting archive.org as a publisher",()=>{
 assert.equal(normalizeHttpsHost("https://web.archive.org/not-a-capture/fifa.com"),null);
 assert.equal(hasIndependentHttpsSources(["https://www.fifa.com/squad.pdf","https://web.archive.org/not-a-capture/fifa.com"]),false);
});

test("accepts independent HTTPS publishers, including multi-label country domains",()=>{
 assert.equal(normalizeHttpsHost("https://www.footballsquads.co.uk/worldcup/"),"footballsquads.co.uk");
 assert.equal(normalizeHttpsHost("https://www.rsssf.org/tables/"),"rsssf.org");
 assert.equal(hasIndependentHttpsSources(["https://www.fifa.com/squad.pdf","https://www.rsssf.org/tables/"]),true);
 assert.equal(hasIndependentHttpsSources(["https://www.footballsquads.co.uk/worldcup/","https://planetworldcup.com/"]),true);
});

test("rejects invalid, insecure and incomplete source lists",()=>{
 assert.equal(hasIndependentHttpsSources(["https://fifa.com","http://rsssf.org"]),false);
 assert.equal(hasIndependentHttpsSources(["https://fifa.com","not a url"]),false);
 assert.equal(hasIndependentHttpsSources(["https://fifa.com"]),false);
 assert.equal(hasIndependentHttpsSources([]),false);
 assert.equal(normalizeHttpsHost("https://co.uk"),null);
});
