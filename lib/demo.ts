import type { AnalysisResult, Page } from "./analysis";
export const DEMO_NAME = "Sample freelance agreement.txt";
export const DEMO_PAGES: Page[] = [{ number: 1, text: `FREELANCE DESIGN SERVICES AGREEMENT

This fictional sample is between Northstar Studio (Client) and the independent designer (Contractor).

1. SERVICES AND FEES
The Contractor will design a brand identity and deliver the agreed files within 30 days. The project fee is INR 60,000, with a 30% deposit payable before work starts. Two rounds of revisions are included.

2. PAYMENT
The remaining balance is payable within 90 days of final delivery. The Client may withhold payment until it is satisfied with all deliverables, at its sole discretion.

3. OWNERSHIP
All work created during the engagement, including unused concepts, pre-existing templates and working methods, becomes the exclusive property of the Client upon creation, regardless of payment.

4. TERMINATION
The Client may terminate this agreement at any time without notice. On termination, the Contractor must refund all amounts received, including fees for work already completed.

5. CONFIDENTIALITY
Both parties will keep non-public business information confidential for two years. This excludes information already publicly available.

6. LIABILITY
The Contractor shall indemnify the Client against all claims, losses and expenses arising from the project, including losses caused by the Client's own modifications, without any financial cap.

7. ADDITIONAL REVISIONS
Additional revisions beyond the two included rounds will be billed at INR 1,500 per hour, subject to written approval by both parties.

8. ACCEPTANCE
The parties will confirm project requirements by email before work begins.
` }];
export const DEMO_RESULT: AnalysisResult = {
  mode: "demo", model: "Illustrative sample", promptVersion: "clauseguard-v1.0", warnings: [],
  report: {
    documentType: "Freelance design agreement",
    summary: "A INR 60,000 design engagement with a 30% deposit and two revision rounds. The sample puts substantial payment, ownership, and cancellation risk on the designer. Clarify the highlighted terms before committing.",
    obligations: ["Deliver the agreed brand identity files within 30 days.", "Include two revision rounds; get written approval for additional hourly work.", "Keep non-public business information confidential for two years."],
    findings: [
      { title: "Payment depends on subjective approval", severity: "high", category: "Payment", page: 1, quote: "The Client may withhold payment until it is satisfied with all deliverables, at its sole discretion.", explanation: "The client decides when the work is satisfactory, without an objective acceptance test or a limit on withholding payment.", implication: "You could deliver the agreed work and still face an open-ended wait for the remaining fee.", question: "Can we agree on objective acceptance criteria, a fixed review period, and a firm payment deadline?" },
      { title: "Ownership transfers before you are paid", severity: "high", category: "Intellectual property", page: 1, quote: "All work created during the engagement, including unused concepts, pre-existing templates and working methods, becomes the exclusive property of the Client upon creation, regardless of payment.", explanation: "The transfer covers unused ideas and materials you already use, and takes effect as soon as work is created.", implication: "You may lose rights to reusable assets and working methods even if the client has not paid.", question: "Can ownership transfer only after full payment, excluding pre-existing materials, tools, and unused concepts?" },
      { title: "Cancellation could erase earned fees", severity: "high", category: "Termination", page: 1, quote: "On termination, the Contractor must refund all amounts received, including fees for work already completed.", explanation: "If the client ends the project, you must return fees even for work you have finished.", implication: "You could spend time on the project and receive no compensation if the client cancels.", question: "Can the agreement require payment for completed work and committed costs, with a reasonable cancellation fee?" },
      { title: "Liability has no financial ceiling", severity: "high", category: "Liability", page: 1, quote: "The Contractor shall indemnify the Client against all claims, losses and expenses arising from the project, including losses caused by the Client's own modifications, without any financial cap.", explanation: "You take on a broad obligation to cover losses, including those resulting from changes the client makes.", implication: "A claim could substantially exceed your fee, including for circumstances outside your control.", question: "Can liability be capped at fees paid and exclude losses caused by the client's modifications or misuse?" },
      { title: "Final payment takes up to 90 days", severity: "medium", category: "Payment timing", page: 1, quote: "The remaining balance is payable within 90 days of final delivery.", explanation: "Most of your fee is deferred for three months after delivery.", implication: "You would need to fund your work and expenses during the payment gap.", question: "Could the balance be paid within 14–30 days or split into delivery milestones?" },
    ],
    missingInformation: ["No governing jurisdiction or dispute resolution process is specified.", "No objective acceptance deadline or feedback resolution process is set out."],
    limitations: ["This is a hand-authored demonstration, not a live Claude analysis.", "Practical risk depends on context and applicable law. This is informational assistance, not legal advice."],
  },
};
