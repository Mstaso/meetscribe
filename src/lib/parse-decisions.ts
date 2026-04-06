/**
 * Robustly parse decisions from LLM output.
 * Same fallback strategies as parse-action-items.ts.
 */

interface Decision {
  content: string;
  rationale: string | null;
  decisionMakers: string | null;
}

export function parseDecisions(raw: string): Decision[] {
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
    .filter((item): item is Decision => item !== null);

  if (listItems.length > 0) return listItems;

  // Strategy 6: Treat whole response as one decision
  if (trimmed.length > 5 && trimmed.length < 500) {
    return [{ content: trimmed, rationale: null, decisionMakers: null }];
  }

  return [];
}

function tryParseJSON(str: string): Decision[] | null {
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

function normalizeItems(items: unknown[]): Decision[] {
  return items
    .filter((item): item is Record<string, unknown> => {
      return item !== null && typeof item === "object";
    })
    .map((item) => {
      const content =
        getString(item, "content") ||
        getString(item, "decision") ||
        getString(item, "description") ||
        getString(item, "text") ||
        "";

      const rationale =
        getString(item, "rationale") ||
        getString(item, "reason") ||
        getString(item, "why") ||
        getString(item, "context") ||
        null;

      const decisionMakers =
        getString(item, "decisionMakers") ||
        getString(item, "decision_makers") ||
        getString(item, "decided_by") ||
        getString(item, "who") ||
        getString(item, "people") ||
        null;

      return { content, rationale, decisionMakers };
    })
    .filter((item) => item.content.length > 0);
}

function getString(obj: Record<string, unknown>, key: string): string | null {
  const val = obj[key];
  if (typeof val === "string" && val.trim() && val.trim().toLowerCase() !== "null") {
    return val.trim();
  }
  return null;
}

function parseListLine(line: string): Decision | null {
  const cleaned = line.replace(/^\s*(?:\d+[.)]\s*|[-*•]\s*)/, "").trim();
  if (!cleaned || cleaned.length < 3) return null;
  return { content: cleaned, rationale: null, decisionMakers: null };
}
