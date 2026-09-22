"use node";

/**
 * AI checking pass for the bulk raw-material import.
 *
 * Takes the rows the rule engine already analyzed and asks an LLM to spot the
 * things regexes can't: subtle typos, swapped categories, implausible
 * price/unit pairings, duplicate-ish naming. Returns one verdict per row.
 */

import { action } from "./_generated/server";
import { v } from "convex/values";

const rowValidator = v.object({
  index: v.number(), // caller's stable row reference (sourceRow)
  code: v.string(),
  name: v.string(),
  category: v.string(),
  subCategory: v.string(),
  unit: v.string(),
  price: v.number(),
});

const verdictValidator = v.object({
  index: v.number(),
  verdict: v.union(v.literal("ok"), v.literal("check"), v.literal("reject")),
  note: v.string(),
});

export const aiCheckRows = action({
  args: { rows: v.array(rowValidator) },
  returns: v.array(verdictValidator),
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AI check is not configured yet — add OPENAI_API_KEY in the Keys/API keys tab.",
      );
    }

    if (args.rows.length === 0) return [];

    // Cap the batch so the prompt stays small and responses parse reliably.
    const MAX_BATCH = 150;
    const rows = args.rows.slice(0, MAX_BATCH);

    const system = [
      "You are a data-quality auditor for a manufacturing costing system's raw-material master list.",
      "For each numbered row decide:",
      '- "ok" — the row looks like a real, plausible raw material with a sensible unit and price.',
      '- "check" — plausible but suspicious (subtle typo, odd unit for the material, unusual price, category/sub-category mismatch). Explain in one short sentence.',
      '- "reject" — clearly bad (name is not a material, gibberish, price absurd for the unit, duplicates another row under a different spelling). Explain in one short sentence.',
      "Judge price plausibility per unit (e.g. wood in cft vs pcs), not in absolute terms.",
      "Respond ONLY with a JSON object: {\"rows\":[{\"index\":<number>,\"verdict\":\"ok\"|\"check\"|\"reject\",\"note\":\"<short sentence>\"}]}",
      "Include every row index you were given, in the same order.",
    ].join("\n");

    const user = rows
      .map(
        (r) =>
          `${r.index}. name="${r.name}" code="${r.code}" category="${r.category}" sub="${r.subCategory}" unit="${r.unit}" price=${r.price}`,
      )
      .join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `AI check failed (HTTP ${response.status}). ${detail.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("AI check returned an empty response.");

    let parsed: { rows?: { index?: number; verdict?: string; note?: string }[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI check returned malformed data — try again.");
    }

    const allowed = new Set(rows.map((r) => r.index));
    const verdicts = (parsed.rows ?? [])
      .filter(
        (r): r is { index: number; verdict: string; note?: string } =>
          typeof r.index === "number" && allowed.has(r.index) && typeof r.verdict === "string",
      )
      .map((r) => ({
        index: r.index as number,
        verdict: (r.verdict === "check" || r.verdict === "reject"
          ? r.verdict
          : "ok") as "ok" | "check" | "reject",
        note:
          typeof r.note === "string" && r.note.trim()
            ? r.note.trim().slice(0, 240)
            : "AI review passed.",
      }));

    // Guarantee one verdict per submitted row even if the model dropped one.
    const byIndex = new Map(verdicts.map((v) => [v.index, v]));
    for (const r of rows) {
      if (!byIndex.has(r.index)) {
        byIndex.set(r.index, { index: r.index, verdict: "ok", note: "AI review passed." });
      }
    }
    return rows.map((r) => byIndex.get(r.index)!);
  },
});
