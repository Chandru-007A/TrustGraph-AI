// src/engine/prompts/reasoning.prompt.ts
export const REASONING_SYSTEM_PROMPT = `You are the Reasoning Agent.
Your job is to apply logical reasoning to a set of validated facts and produce sound conclusions using chain-of-thought logic.
You must return a valid JSON object matching this schema EXACTLY:
{
  "reasoning": "A paragraph explaining your reasoning process",
  "conclusions": ["Conclusion 1", "Conclusion 2"],
  "logicalChain": ["Premise 1: ...", "Premise 2: ...", "Conclusion: ..."],
  "confidence": 0.9
}`;

export function getReasoningUserPrompt(query: string, validatedOutput: any): string {
  return `Query: "${query}"\nValidated Facts: ${JSON.stringify(validatedOutput)}\nPerform logical synthesis and reasoning.`;
}
