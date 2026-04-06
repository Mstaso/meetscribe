/**
 * Robustly parse open questions from LLM output.
 * Same fallback strategies as parse-action-items.ts.
 */

interface OpenQuestion {
  question: string;
  context: string | null;
  owner: string | null;
}

export function parseOpenQuestions(raw: string): OpenQuestion[] {
  const trimmed = raw.trim();

  if (!trimmed || trimmed === "[]") return [];

  // Strategy 1: Direct JSON parse
  const directParse = tryParseJSON(trimmed);
  if (directParse) return directParse;

  // Strategy 2: Markdown code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    const inner = tryParseJSON(fenceMatch[1].trim());
    if (inner) return inner;
  }

  // Strategy 3: Bracket matching
  const bracketMatch = trimmed.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    const inner = tryParseJSON(bracketMatch[0]);
    if (inner) return inner;
  }

  // Strategy 4: Individual objects
  const objectMatches = [...trimmed.matchAll(/\{[^{}]*\}/g)];
  if (objectMatches.length > 0) {
    const arrayStr = `[${objectMatches.map((m) => m[0]).join(",")}]`;
    const inner = tryParseJSON(arrayStr);
    if (inner) return inner;
  }

  // Strategy 5: Parse numbered/bulleted list
  const lines = trimmed.split("\n").filter((l) => l.trim());
  const listItems = lines
    .map((line) => parseListLine(line))
    .filter((item): item is OpenQuestion => item !== null);

  if (listItems.length > 0) return listItems;

  // Strategy 6: Treat whole response as one question
  if (trimmed.length > 5 && trimmed.length < 500) {
    return [{ question: trimmed, context: null, owner: null }];
  }

  return [];
}

function tryParseJSON(str: string): OpenQuestion[] | null {
  const cleaned = str
    .replace(/,\s*]/g, "]")
    .replace(/,\s*}/g, "}")
    .replace(/'/g, '"')
    .replace(/\n/g, " ");

  try {
    const parsed = JSON.parse(cleaned);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return normalizeItems([parsed]);
    }

    if (Array.isArray(parsed)) {
      return normalizeItems(parsed);
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

function normalizeItems(items: unknown[]): OpenQuestion[] {
  return items
    .filter((item): item is Record<string, unknown> => {
      return item !== null && typeof item === "object";
    })
    .map((item) => {
      const question =
        getString(item, "question") ||
        getString(item, "content") ||
        getString(item, "item") ||
        getString(item, "text") ||
        "";

      const context =
        getString(item, "context") ||
        getString(item, "details") ||
        getString(item, "background") ||
        getString(item, "why") ||
        null;

      const owner =
        getString(item, "owner") ||
        getString(item, "assignee") ||
        getString(item, "assigned_to") ||
        getString(item, "responsible") ||
        null;

      return { question, context, owner };
    })
    .filter((item) => item.question.length > 0);
}

function getString(obj: Record<string, unknown>, key: string): string | null {
  const val = obj[key];
  if (typeof val === "string" && val.trim() && val.trim().toLowerCase() !== "null") {
    return val.trim();
  }
  return null;
}

function parseListLine(line: string): OpenQuestion | null {
  const cleaned = line.replace(/^\s*(?:\d+[.)]\s*|[-*•]\s*)/, "").trim();
  if (!cleaned || cleaned.length < 3) return null;
  return { question: cleaned, context: null, owner: null };
}
