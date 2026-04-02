/**
 * Robustly parse action items from LLM output.
 * Handles common failure modes from weaker models:
 * - JSON wrapped in markdown code fences (```json ... ```)
 * - Preamble/explanation text before or after the JSON
 * - Numbered or bulleted lists instead of JSON
 * - Malformed JSON with trailing commas
 * - Single object instead of array
 * - Empty or whitespace-only responses
 */

interface ActionItem {
  content: string;
  assignee: string | null;
}

export function parseActionItems(raw: string): ActionItem[] {
  const trimmed = raw.trim();

  if (!trimmed || trimmed === "[]") return [];

  // Strategy 1: Try direct JSON parse
  const directParse = tryParseJSON(trimmed);
  if (directParse) return directParse;

  // Strategy 2: Extract JSON from markdown code fences
  //   ```json\n[...]\n```  or  ```\n[...]\n```
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    const inner = tryParseJSON(fenceMatch[1].trim());
    if (inner) return inner;
  }

  // Strategy 3: Find the first [ ... ] in the response (model added explanation text around it)
  const bracketMatch = trimmed.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    const inner = tryParseJSON(bracketMatch[0]);
    if (inner) return inner;
  }

  // Strategy 4: Find individual { ... } objects (model returned objects without wrapping array)
  const objectMatches = [...trimmed.matchAll(/\{[^{}]*\}/g)];
  if (objectMatches.length > 0) {
    const arrayStr = `[${objectMatches.map((m) => m[0]).join(",")}]`;
    const inner = tryParseJSON(arrayStr);
    if (inner) return inner;
  }

  // Strategy 5: Parse numbered/bulleted list as plain text action items
  //   "1. Do something (assigned to John)"
  //   "- Do something @John"
  //   "* Do something"
  const lines = trimmed.split("\n").filter((l) => l.trim());
  const listItems = lines
    .map((line) => parseListLine(line))
    .filter((item): item is ActionItem => item !== null);

  if (listItems.length > 0) return listItems;

  // Strategy 6: If all else fails and there's meaningful text, treat the whole thing as one item
  if (trimmed.length > 5 && trimmed.length < 500) {
    return [{ content: trimmed, assignee: null }];
  }

  return [];
}

function tryParseJSON(str: string): ActionItem[] | null {
  // Clean common JSON issues from weaker models
  let cleaned = str
    .replace(/,\s*]/g, "]")        // trailing commas before ]
    .replace(/,\s*}/g, "}")        // trailing commas before }
    .replace(/'/g, '"')            // single quotes to double quotes
    .replace(/\n/g, " ");          // newlines within JSON

  try {
    const parsed = JSON.parse(cleaned);

    // Handle single object instead of array
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

function normalizeItems(items: unknown[]): ActionItem[] {
  return items
    .filter((item): item is Record<string, unknown> => {
      return item !== null && typeof item === "object";
    })
    .map((item) => {
      // Handle various key names models might use
      const content =
        getString(item, "content") ||
        getString(item, "task") ||
        getString(item, "action") ||
        getString(item, "action_item") ||
        getString(item, "description") ||
        getString(item, "text") ||
        "";

      const assignee =
        getString(item, "assignee") ||
        getString(item, "assigned_to") ||
        getString(item, "owner") ||
        getString(item, "person") ||
        getString(item, "responsible") ||
        null;

      return { content, assignee };
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

function parseListLine(line: string): ActionItem | null {
  // Strip list markers: "1.", "1)", "-", "*", "•"
  const cleaned = line.replace(/^\s*(?:\d+[.)]\s*|[-*•]\s*)/, "").trim();
  if (!cleaned || cleaned.length < 3) return null;

  // Try to extract assignee from common patterns:
  //   "(assigned to John)", "(John)", "@John", "- John"
  let assignee: string | null = null;
  let content = cleaned;

  const assignedMatch = cleaned.match(
    /\(?(?:assigned?\s+to|assignee[:\s]|owner[:\s]|@)\s*([A-Z][a-zA-Z\s]+?)\)?\.?\s*$/i
  );
  if (assignedMatch) {
    assignee = assignedMatch[1].trim();
    content = cleaned.slice(0, assignedMatch.index).replace(/\s*[-–—]\s*$/, "").trim();
  }

  if (!content) return null;
  return { content, assignee };
}
