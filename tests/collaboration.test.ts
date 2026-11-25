import { test } from "node:test";
import assert from "node:assert/strict";
import { composeDraft, verifyCitations, verifyProposals, chatRequestSchema, type Proposal } from "../lib/collaboration.ts";
import { DEMO_PAGES, DEMO_RESULT } from "../lib/demo.ts";
const proposal:Proposal={id:"p1",page:1,title:"Fair cancellation",original:DEMO_RESULT.report.findings[2].quote,replacement:"On termination, the Client must pay for completed work and approved non-cancellable costs, less amounts already paid. Only any excess prepayment will be refunded.",rationale:"Avoid erasing earned fees.",firstPartyImpact:"Client pays for value received.",secondPartyImpact:"Contractor keeps earned fees.",tradeOff:"Agree how completed work is valued."};
const output=(proposals:Proposal[])=>({introduction:"Proposals for review.",proposals,openQuestions:[]});
test("only verified citations are retained; unsupported answers get an explicit warning",()=>{
  const checked=verifyCitations({answer:"Explanation",citations:[{page:1,quote:proposal.original},{page:1,quote:"This passage was invented and is not in the contract."}],followUpQuestions:[]},DEMO_PAGES);
  assert.equal(checked.citations.length,1);assert.equal(checked.warnings.length,1);
  assert.equal(verifyCitations({answer:"General answer",citations:[],followUpQuestions:[]},DEMO_PAGES).warnings.length,1);
});
test("draft composition changes selected wording and preserves all surrounding text",()=>{
  const draft=composeDraft(DEMO_PAGES,[proposal]);
  assert.equal(draft,DEMO_PAGES[0].text.replace(proposal.original,proposal.replacement));
  assert.ok(draft.includes("The project fee is INR 60,000"));
  assert.ok(draft.includes("Both parties will keep non-public business information confidential"));
});
test("overlapping proposals are omitted and cannot be applied together",()=>{
  const overlap={...proposal,id:"p2",original:"the Contractor must refund all amounts received, including fees for work already completed."};
  const checked=verifyProposals(output([proposal,overlap]),DEMO_PAGES);
  assert.equal(checked.proposals.length,1);assert.match(checked.warnings[0],/overlaps/);
  assert.throws(()=>composeDraft(DEMO_PAGES,[proposal,overlap]),/conflict/);
});
test("ambiguous, invented and unchanged replacements cannot modify agreements",()=>{
  const ambiguous=[{number:1,text:proposal.original+"\n"+proposal.original}];
  assert.equal(verifyProposals(output([proposal]),ambiguous).proposals.length,0);
  assert.equal(verifyProposals(output([{...proposal,original:"This text does not exist in the source document."}]),DEMO_PAGES).proposals.length,0);
  assert.equal(verifyProposals(output([{...proposal,replacement:proposal.original}]),DEMO_PAGES).proposals.length,0);
  assert.throws(()=>composeDraft(DEMO_PAGES,[]),/Select at least one/);
});
test("page boundaries and whitespace variations preserve the complete source",()=>{
  const first={number:1,text:"Page one stays unchanged."};
  const second={number:2,text:"Before. "+proposal.original.replaceAll(" ","  ")+" After."};
  const checked=verifyProposals(output([{...proposal,page:2}]),[first,second]);
  assert.equal(checked.proposals.length,1);
  assert.equal(composeDraft([first,second],checked.proposals),first.text+"\n\nBefore. "+proposal.replacement+" After.");
});
test("chat requires agreement consent and caps conversation context",()=>{
  const agreement={pages:DEMO_PAGES,documentName:"Example",agreementType:"Freelance",jurisdiction:"",perspective:"Freelancer",consent:true};
  const input={agreement,question:"Can the client cancel?",history:[],documentVersion:"original"};
  assert.equal(chatRequestSchema.safeParse(input).success,true);
  assert.equal(chatRequestSchema.safeParse({...input,agreement:{...agreement,consent:false}}).success,false);
  assert.equal(chatRequestSchema.safeParse({...input,history:Array.from({length:5},()=>({role:"user",content:"a".repeat(9000)}))}).success,false);
});
test("chat withholds invented or miscalculated currency totals",()=>{
  const answer={answer:"The fee is INR 60,000, the deposit is INR 18,000, and the remaining balance is INR 54,000.",citations:[{page:1,quote:DEMO_RESULT.report.findings[0].quote}],followUpQuestions:[]};
  const checked=verifyCitations(answer,DEMO_PAGES);
  assert.doesNotMatch(checked.answer,/54,000/);
  assert.match(checked.warnings.join(" "),/withheld/);
  const supported=verifyCitations({...answer,answer:"The stated fee is INR 60000 and the deposit is 30%."},DEMO_PAGES);
  assert.equal(supported.answer,"The stated fee is INR 60000 and the deposit is 30%.");
});
