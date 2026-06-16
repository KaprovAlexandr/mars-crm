import fs from "fs";

const xml = fs.readFileSync("_diplom_kaprov_extract/word/document.xml", "utf8");
const paras = [];
const pRe = /<w:p[\s>][\s\S]*?<\/w:p>/g;
let p;
while ((p = pRe.exec(xml))) {
  const t = [];
  const tRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = tRe.exec(p[0]))) t.push(m[1]);
  if (t.length) paras.push(t.join(""));
}
const body = paras.join("\n");
fs.writeFileSync("_diplom_kaprov_text.txt", body, "utf8");
console.log("paragraphs", paras.length, "chars", body.length);
