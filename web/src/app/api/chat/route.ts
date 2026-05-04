import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL } from "../../../lib/openai";

export const runtime = "nodejs";

type ChatFilters = {
  start?: string;
  end?: string;
  locationId?: string;
  categoryId?: string;
};

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  message: string;
  filters?: ChatFilters;
  history?: HistoryMessage[];
};

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type OpenAIResponse = {
  choices?: Array<{
    message?: ChatMessage;
  }>;
};

function buildSchemaDoc(activeDatasetId: string) {
  return `
The main table is raw_inventory_v. Always filter by dataset_id = '${activeDatasetId}'.

raw_inventory_v columns:
  dataset_id TEXT
  date TIMESTAMP
  location_id TEXT
  item_id REAL
  item_name TEXT
  event_time_stamps TIMESTAMP
  event_type TEXT
  quantity REAL
  receipts_qty REAL
  issues_qty REAL
  current_stock_avg REAL
  unit_cost_large_box REAL
  total_cost REAL
  opening_qty REAL
  closing_qty REAL
  min_qty REAL
  max_qty REAL
  lot_number TEXT
  lot_expiry TIMESTAMP
  reason TEXT
  period_start TIMESTAMP
  period_end TIMESTAMP
  inventory_value REAL
  avg_usage_per_day REAL
  vendor_id TEXT

locations columns:
  locations(location_id INTEGER, location_code TEXT, location_name TEXT)
  Join pattern: CAST(REPLACE(UPPER(ri.location_id), 'LOC', '') AS INTEGER) = locations.location_id

Important query patterns:
- ALWAYS include: ri.dataset_id = '${activeDatasetId}'
- Date filter: substr(ri.event_time_stamps, 1, 10) BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD'
- Event type: UPPER(TRIM(ri.event_type)) IN ('RECEIPT','ISSUE','ADJUSTMENT_WASTE')
- Location filter: UPPER(TRIM(ri.location_id)) = 'LOC1' (or LOC2, LOC3)
- quantity is positive for all event types
`.trim();
}

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "query_database",
      description:
        "Run a read-only SQL query against live inventory data in SQLite and return rows.",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "Read-only SQL SELECT query.",
          },
          reason: {
            type: "string",
            description: "Short reason for this query.",
          },
        },
        required: ["sql"],
      },
    },
  },
];

function mustGetOpenAIKey() {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.includes("PASTE_KEY_HERE")) {
    throw new Error(
      "OpenAI key not configured: set OPENAI_API_KEY in web/.env.local"
    );
  }
  if (!OPENAI_MODEL || OPENAI_MODEL.includes("PASTE_MODEL_HERE")) {
    throw new Error(
      "OpenAI model not configured: set OPENAI_MODEL in web/.env.local (optional)"
    );
  }
}

function sanitizeSql(sqlRaw: string) {
  const sql = sqlRaw.trim().replace(/;\s*$/, "");
  const upper = sql.toUpperCase();

  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    throw new Error("Only SELECT queries are allowed.");
  }
  if (sql.includes(";")) throw new Error("Semicolons are not allowed.");
  if (sql.includes("--") || sql.includes("/*") || sql.includes("*/")) {
    throw new Error("SQL comments are not allowed.");
  }

  const forbidden = [
    "INSERT",
    "DELETE",
    "DROP",
    "ALTER",
    "CREATE",
    "PRAGMA",
    "ATTACH",
    "DETACH",
    "VACUUM",
    "REINDEX",
    "TRIGGER",
  ];
  for (const kw of forbidden) {
    const re = new RegExp(`\\b${kw}\\b`);
    if (re.test(upper)) throw new Error(`Forbidden keyword: ${kw}`);
  }
  if (/\bUPDATE\b/.test(upper) && !upper.includes("UPDATED_AT")) {
    throw new Error("Forbidden keyword: UPDATE");
  }

  const allowedTables = ["RAW_INVENTORY_V", "LOCATIONS"];
  if (!allowedTables.some((t) => upper.includes(t))) {
    throw new Error("Query must reference at least one allowed table.");
  }

  if (!upper.includes("LIMIT")) return `${sql} LIMIT 200`;
  return sql;
}

function runReadOnlyQuery(sql: string): unknown[] {
  const db = getDb();
  return db.prepare(sql).all();
}

function getActiveDatasetId(): string {
  const db = getDb();
  const active = db
    .prepare(
      `
      SELECT dataset_id
      FROM datasets
      WHERE is_active = 1
      ORDER BY imported_at DESC
      LIMIT 1
      `,
    )
    .get() as { dataset_id?: string } | undefined;

  if (active?.dataset_id) return active.dataset_id;

  const fallback = db
    .prepare(
      `
      SELECT dataset_id
      FROM raw_inventory_v
      WHERE TRIM(COALESCE(dataset_id, '')) <> ''
      GROUP BY dataset_id
      ORDER BY MAX(datetime(event_time_stamps)) DESC
      LIMIT 1
      `,
    )
    .get() as { dataset_id?: string } | undefined;

  if (fallback?.dataset_id) return fallback.dataset_id;
  throw new Error("No active dataset found.");
}

function enforceActiveDataset(sql: string, activeDatasetId: string): string {
  if (!/\braw_inventory_v\b/i.test(sql)) return sql;
  const safeId = activeDatasetId.replace(/'/g, "''");
  // Force raw table reads to the currently active dataset.
  return sql.replace(
    /\braw_inventory_v\b/gi,
    `(SELECT * FROM raw_inventory_v WHERE dataset_id = '${safeId}')`,
  );
}

function buildSystemPrompt(filters: ChatFilters | undefined, activeDatasetId: string) {
  const scope = {
    start: filters?.start ?? null,
    end: filters?.end ?? null,
    locationId: filters?.locationId ?? null,
    categoryId: filters?.categoryId ?? null,
  };

  return `
You are a friendly, helpful hospital inventory assistant in a dashboard.
Talk naturally like a human teammate: concise and practical.

Use the "query_database" tool whenever a user asks for inventory data. Do not guess numbers.

${buildSchemaDoc(activeDatasetId)}

Active dashboard filters (apply silently; do not echo them unless asked):
${JSON.stringify(scope, null, 2)}

SQL guidelines:
- SELECT / WITH ... SELECT only
- ALWAYS include ri.dataset_id = '${activeDatasetId}'
- Apply date filters with substr(ri.event_time_stamps, 1, 10)
- Apply location filter with UPPER(TRIM(ri.location_id))
- Compare event types with UPPER(TRIM(ri.event_type))
- Keep results small (use LIMIT)

Final response style:
- natural and conversational
- plain text only (no markdown tables/code blocks)
- give direct answer first, then short detail
`.trim();
}

async function callOpenAI(messages: ChatMessage[], useTools: boolean) {
  mustGetOpenAIKey();

  const payload: Record<string, unknown> = {
    model: OPENAI_MODEL,
    stream: false,
    temperature: 0.2,
    messages,
  };

  if (useTools) {
    payload.tools = TOOLS;
    payload.tool_choice = "auto";
  }

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }

  const json = (await res.json()) as OpenAIResponse;
  const choice = json?.choices?.[0];
  if (!choice?.message) {
    throw new Error("Invalid OpenAI response.");
  }
  return choice.message;
}

const MAX_TOOL_ROUNDS = 5;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequest;
    const userMessage = (body?.message ?? "").trim();
    if (!userMessage) {
      return NextResponse.json({ error: "Missing message." }, { status: 400 });
    }

    const activeDatasetId = getActiveDatasetId();
    const systemPrompt = buildSystemPrompt(body.filters, activeDatasetId);
    const historyMsgs: ChatMessage[] = (body.history ?? [])
      .filter((h) => h.content && (h.role === "user" || h.role === "assistant"))
      .slice(-20)
      .map((h) => ({ role: h.role, content: h.content }));

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...historyMsgs,
      { role: "user", content: userMessage },
    ];

    let usedSql: string | null = null;
    let totalRows = 0;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const assistantMsg = await callOpenAI(messages, true);

      if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
        const reply = (assistantMsg.content ?? "").trim() || "Sorry, I couldn't generate a response.";
        return NextResponse.json({
          reply,
          meta: { usedSql, rows: totalRows },
        });
      }

      messages.push(assistantMsg);

      for (const toolCall of assistantMsg.tool_calls) {
        if (toolCall.function.name !== "query_database") {
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` }),
          });
          continue;
        }

        let toolContent: string;
        try {
          const args = JSON.parse(toolCall.function.arguments) as { sql?: string };
          const safeSql = sanitizeSql(args.sql ?? "");
          const scopedSql = enforceActiveDataset(safeSql, activeDatasetId);
          usedSql = scopedSql;
          const rows = runReadOnlyQuery(scopedSql);
          totalRows = rows.length;
          toolContent = JSON.stringify(rows).slice(0, 15000);
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          toolContent = JSON.stringify({ error: errMsg });
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolContent,
        });
      }
    }

    return NextResponse.json({
      reply: "I couldn't finish the data lookup in time. Please rephrase and try again.",
      meta: { usedSql, rows: totalRows },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat error." },
      { status: 500 },
    );
  }
}
