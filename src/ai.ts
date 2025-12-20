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

const SUMMARY_PROMPT = `You are an expert developer. Summarize the staged git diff into a concise multi-line summary suitable for a changelog. Use bullets or short paragraphs. Be factual and list key changes, affected files and summary lines.`;

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: any[],
  max_tokens = 500
) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages,
        max_tokens,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as any;
  return data.choices[0].message.content.trim();
}

export async function generateCommitMessage(
  apiKey: string,
  model: string,
  diff: string
): Promise<string> {
  try {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Here is the git diff to analyze:\n${diff}` },
    ];
    return await callOpenRouter(apiKey, model, messages, 300);
  } catch (error) {
    throw new Error(`AI Generation failed: ${(error as Error).message}`);
  }
}

export async function generateSummary(
  apiKey: string,
  model: string,
  diff: string
): Promise<string> {
  try {
    const messages = [
      { role: "system", content: SUMMARY_PROMPT },
      {
        role: "user",
        content: `Here is the git diff:\n${diff} \n\n Just drop a no-comment a Pull request description ready to copy paste.`,
      },
    ];
    return await callOpenRouter(apiKey, model, messages, 800);
  } catch (error) {
    throw new Error(`AI Summary failed: ${(error as Error).message}`);
  }
}

export async function generateChangelogEntry(
  apiKey: string,
  model: string,
  diff: string
): Promise<string> {
  const summary = await generateSummary(apiKey, model, diff);
  return summary;
}
