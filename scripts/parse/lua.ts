import { parse as luaparse } from "luaparse";
import type {
  AssignmentStatement,
  Chunk,
  Expression,
  IndexExpression,
  ReturnStatement,
  TableConstructorExpression,
} from "luaparse";
import {
  astToJsValue,
  createDiagnostics,
  type AstContext,
  type Diagnostics,
} from "./lua-value.js";

export interface ParsedTable {
  data: Record<string, unknown>;
  diagnostics: Diagnostics;
}

const LUA_PARSE_OPTIONS = {
  comments: false,
  locations: false,
  ranges: false,
  scope: false,
  luaVersion: "5.3" as const,
  encodingMode: "pseudo-latin1" as const,
};

export function readLuaSource(buffer: Buffer): string {
  return buffer.toString("latin1");
}

export function parseReturnTable(source: string, opts: { skipKeys?: Set<string> } = {}): ParsedTable {
  const chunk = parseChunk(source);
  const ret = chunk.body.find((s): s is ReturnStatement => s.type === "ReturnStatement");
  if (!ret) throw new Error("Expected a top-level return statement");
  const first = ret.arguments[0];
  if (!first || first.type !== "TableConstructorExpression") {
    throw new Error(`Expected return <table>, got ${first?.type ?? "nothing"}`);
  }

  const diagnostics = createDiagnostics();
  const ctx: AstContext = {
    path: "",
    diag: diagnostics,
    skipKeys: opts.skipKeys ?? new Set(),
  };

  const value = astToJsValue(first as TableConstructorExpression, ctx);
  if (!isPlainObject(value)) {
    throw new Error(`Expected return table to produce an object, got ${describe(value)}`);
  }
  return { data: value, diagnostics };
}

export function parseAssignmentTable(
  source: string,
  opts: { expectedBaseNames?: ReadonlyArray<string>; skipKeys?: Set<string> } = {},
): ParsedTable {
  const chunk = parseChunk(source);
  const diagnostics = createDiagnostics();
  const data: Record<string, unknown> = {};
  const expected = opts.expectedBaseNames ? new Set(opts.expectedBaseNames) : null;
  const skipKeys = opts.skipKeys ?? new Set<string>();

  for (const stmt of chunk.body) {
    if (stmt.type !== "AssignmentStatement") continue;
    const assign = stmt as AssignmentStatement;
    if (assign.variables.length !== 1 || assign.init.length !== 1) continue;

    const target = assign.variables[0]!;
    if (target.type !== "IndexExpression") continue;
    const idx = target as IndexExpression;
    if (idx.base.type !== "Identifier") continue;
    if (expected && !expected.has(idx.base.name)) continue;

    const keyExpr = idx.index;
    let key: string | null = null;
    if (keyExpr.type === "StringLiteral") key = Buffer.from(keyExpr.value, "latin1").toString("utf8");
    else if (keyExpr.type === "NumericLiteral") key = String(keyExpr.value);
    if (key === null) continue;

    const valueExpr = assign.init[0]!;
    if (valueExpr.type !== "TableConstructorExpression") continue;

    const ctx: AstContext = {
      path: key,
      diag: diagnostics,
      skipKeys,
    };
    const value = astToJsValue(valueExpr as Expression, ctx);
    if (isPlainObject(value)) data[key] = value;
  }

  return { data, diagnostics };
}

function parseChunk(source: string): Chunk {
  return luaparse(source, LUA_PARSE_OPTIONS) as Chunk;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function describe(v: unknown): string {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  return typeof v;
}
