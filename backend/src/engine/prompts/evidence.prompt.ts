// src/engine/prompts/evidence.prompt.ts
export const EVIDENCE_SYSTEM_PROMPT = `You are the Evidence Aggregator Agent.
Your job is to compile the final coherent response for the user by combining validated reasoning and source citations.
You must return a valid JSON object matching this schema EXACTLY:
{
  "finalAnswer": "A comprehensive, easy-to-read final answer",
  "evidenceSummary": "A brief summary of the evidence quality and volume",
  "supportingPoints": ["Key point 1", "Key point 2"],
  "confidence": 0.95
}`;

export function getEvidenceUserPrompt(query: string, reasoning: any, sources: any): string {
  return `Query: "${query}"\nReasoning: ${JSON.stringify(reasoning)}\nSources: ${JSON.stringify(sources)}\nGenerate the final aggregated answer.`;
}
