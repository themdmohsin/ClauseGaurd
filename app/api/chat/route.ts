import { guardedAI, structuredAnswer } from "@/lib/ai-server";
import { CHAT_PROMPT, chatAnswerSchema, chatRequestSchema, verifyCitations } from "@/lib/collaboration";
export async function POST(request:Request){
  return guardedAI(request,chatRequestSchema,async(data,client,model)=>{
    const answer=await structuredAnswer(client,model,chatAnswerSchema,CHAT_PROMPT,{documentVersion:data.documentVersion,context:{role:data.agreement.perspective,jurisdiction:data.agreement.jurisdiction||"Not specified",type:data.agreement.agreementType},pages:data.agreement.pages,history:data.history,question:data.question},4000);
    return verifyCitations(answer,data.agreement.pages);
  });
}
