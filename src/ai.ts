import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
You are an expert developer using the Conventional Commits specification.
Review the provided git diff and generate a commit message.

STRICT RULES:
1. Output MUST be a SINGLE LINE. No body, no bullets, no explanations.
2. Format: <type>(<optional scope>): <description>
3. Types must be one of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
4. Subject MUST be under 150 characters.
5. No markdown formatting. No code blocks. No quotes. No multi-line output.
6. Be brutally concise. Summarize the core change only.

Example output:
feat(auth): add google login
`;

export async function generateCommitMessage(
  apiKey: string,
  diff: string
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);

  // Using 'gemini-2.0-flash' as it is fast and available in the stable API
  // If this model is not available, fallback options: 'gemini-1.5-pro' or 'gemini-1.5-flash-latest'
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
${SYSTEM_PROMPT}

Here is the git diff to analyze:
${diff}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text().trim();
  } catch (error) {
    throw new Error(`AI Generation failed: ${(error as Error).message}`);
  }
}
