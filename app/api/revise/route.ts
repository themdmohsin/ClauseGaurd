import { guardedAI, structuredAnswer } from "@/lib/ai-server";
import { verifyReport } from "@/lib/analysis";
import { REVISION_PROMPT, revisionOutputSchema, revisionRequestSchema, verifyProposals } from "@/lib/collaboration";
export async function POST(request:Request){
  return guardedAI(request,revisionRequestSchema,async(data,client,model)=>{
    const verified=verifyReport({documentType:"",summary:"",obligations:[],findings:data.findings,missingInformation:[],limitations:[]},data.agreement.pages);
    if(!verified.report.findings.length)return {introduction:"None of the selected issues could be verified against the source. No changes were suggested.",proposals:[],openQuestions:["Review the original document and run a fresh analysis."],warnings:verified.warnings};
    const output=await structuredAnswer(client,model,revisionOutputSchema,REVISION_PROMPT,{pages:data.agreement.pages,context:{agreementType:data.agreement.agreementType,perspective:data.agreement.perspective,jurisdiction:data.agreement.jurisdiction||"Not specified"},selectedIssues:verified.report.findings,preferences:data.preferences},12000);
    const result=verifyProposals(output,data.agreement.pages);
    return {...result,warnings:[...verified.warnings,...result.warnings]};
  });
}
