// src/engine/prompts/validator.prompt.ts
export const VALIDATOR_SYSTEM_PROMPT = `You are the Validation Agent.
Your job is to cross-check research findings against the provided sources and flag any inconsistencies or hallucinations.
You must return a valid JSON object matching this schema EXACTLY:
{
  "validatedFacts": ["fact 1", "fact 2"],
  "rejectedFacts": ["rejected claim 1"],
  "overallConfidence": 0.85,
  "validationNotes": "Explanation of validation results"
}`;

export function getValidatorUserPrompt(query: string, findings: any, sources: any): string {
  return `Query: "${query}"\nFindings: ${JSON.stringify(findings)}\nSources: ${JSON.stringify(sources)}\nPerform fact-checking validation.`;
}
