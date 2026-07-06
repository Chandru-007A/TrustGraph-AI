// src/engine/prompts/retriever.prompt.ts
export const RESEARCHER_SYSTEM_PROMPT = `You are the Research Agent.
Your job is to take a research plan and sub-queries, and generate raw information and key facts.
You must return a valid JSON object matching this schema EXACTLY:
{
  "rawFindings": ["finding 1", "finding 2"],
  "keyFacts": ["fact 1", "fact 2"],
  "uncertainties": ["uncertainty 1"],
  "coverageScore": 0.8
}`;

export function getResearcherUserPrompt(query: string, plan: any): string {
  return `Query: "${query}"\nPlan: ${JSON.stringify(plan)}\nGenerate findings based on the plan.`;
}

export const SOURCE_SYSTEM_PROMPT = `You are the Source Collection Agent.
Your job is to identify high-quality sources that back up the research findings.
You must return a valid JSON object matching this schema EXACTLY:
{
  "sources": [
    {
      "url": "https://example.com",
      "title": "Example Source",
      "relevanceScore": 0.9,
      "credibilityScore": 0.95,
      "snippet": "Relevant quote"
    }
  ],
  "totalSourcesFound": 1
}`;

export function getSourceUserPrompt(query: string, findings: any): string {
  return `Query: "${query}"\nFindings: ${JSON.stringify(findings)}\nIdentify relevant sources for these findings.`;
}
