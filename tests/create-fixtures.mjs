// Fictional local files for exercising the browser extraction flow.
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("work/fixtures", { recursive: true });
const lines = ["SAMPLE SERVICE AGREEMENT", "The customer shall pay INR 5000 per month for the agreed services.", "Either party may terminate with 30 days written notice.", "The provider must give 30 days notice before any price changes.", "This fictional agreement is only a software test fixture."];
function pdf(blank = false) {
  const stream = blank ? "" : `BT /F1 12 Tf 50 740 Td ${lines.map((line,i)=>`${i ? "0 -24 Td " : ""}(${line}) Tj`).join("\n")} ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(content));content+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const xref = Buffer.byteLength(content);
  content += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n` + offsets.slice(1).map(n=>`${String(n).padStart(10,"0")} 00000 n \n`).join("");
  return content + `trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}
writeFileSync("work/fixtures/service.txt", lines.join("\n"));
writeFileSync("work/fixtures/service.pdf", pdf());
writeFileSync("work/fixtures/blank.pdf", pdf(true));
console.log("Created fictional TXT, text PDF, and blank PDF in work/fixtures.");
