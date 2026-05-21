import type {
  BinaryExpression,
  BooleanLiteral,
  Expression,
  Identifier,
  MemberExpression,
  NilLiteral,
  NumericLiteral,
  StringLiteral,
  TableConstructorExpression,
  TableKey,
  TableKeyString,
  TableValue,
  UnaryExpression,
} from "luaparse";

type TableField = TableKey | TableKeyString | TableValue;

export interface Diagnostics {
  droppedCalls: number;
  droppedSamples: string[];
  skippedKeys: Map<string, number>;
}

export interface AstContext {
  path: string;
  diag: Diagnostics;
  skipKeys: Set<string>;
}

export function createDiagnostics(): Diagnostics {
  return {
    droppedCalls: 0,
    droppedSamples: [],
    skippedKeys: new Map(),
  };
}

const DROP = Symbol("luaDrop");
type Drop = typeof DROP;

function latin1ToUtf8(s: string): string {
  return Buffer.from(s, "latin1").toString("utf8");
}

export function astToJsValue(expr: Expression, ctx: AstContext): unknown {
  switch (expr.type) {
    case "StringLiteral":
      return latin1ToUtf8((expr as StringLiteral).value);
    case "NumericLiteral":
      return (expr as NumericLiteral).value;
    case "BooleanLiteral":
      return (expr as BooleanLiteral).value;
    case "NilLiteral":
      return null;
    case "UnaryExpression":
      return evaluateUnary(expr as UnaryExpression, ctx);
    case "BinaryExpression":
      return evaluateBinary(expr as BinaryExpression, ctx);
    case "Identifier":
      return (expr as Identifier).name;
    case "MemberExpression":
      return memberExpressionToString(expr as MemberExpression, ctx);
    case "TableConstructorExpression":
      return tableToJs(expr as TableConstructorExpression, ctx);
    default:
      recordDrop(ctx, expr.type);
      return DROP;
  }
}

function evaluateUnary(expr: UnaryExpression, ctx: AstContext): unknown {
  const inner = astToJsValue(expr.argument, ctx);
  if (expr.operator === "-" && typeof inner === "number") {
    return -inner;
  }
  if (expr.operator === "not" && typeof inner === "boolean") {
    return !inner;
  }
  recordDrop(ctx, `Unary:${expr.operator}`);
  return DROP;
}

function evaluateBinary(expr: BinaryExpression, ctx: AstContext): unknown {
  if (expr.operator === "..") {
    const l = astToJsValue(expr.left, ctx);
    const r = astToJsValue(expr.right, ctx);
    if (typeof l === "string" && typeof r === "string") return l + r;
    if ((typeof l === "string" || typeof l === "number") && (typeof r === "string" || typeof r === "number")) {
      return String(l) + String(r);
    }
  }
  recordDrop(ctx, `Binary:${expr.operator}`);
  return DROP;
}

function memberExpressionToString(expr: MemberExpression, ctx: AstContext): unknown {
  const parts: string[] = [expr.identifier.name];
  let cursor: Expression = expr.base;
  while (cursor.type === "MemberExpression") {
    parts.unshift(cursor.identifier.name);
    cursor = cursor.base;
  }
  if (cursor.type === "Identifier") {
    parts.unshift(cursor.name);
    return parts.join(".");
  }
  recordDrop(ctx, `MemberBase:${cursor.type}`);
  return DROP;
}

function tableToJs(tbl: TableConstructorExpression, ctx: AstContext): unknown {
  const fields = tbl.fields;

  let hasExplicitKey = false;
  for (const f of fields) {
    if (f.type === "TableKey" || f.type === "TableKeyString") {
      hasExplicitKey = true;
      break;
    }
  }

  if (!hasExplicitKey) {
    const arr: unknown[] = [];
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i]!;
      if (f.type !== "TableValue") {
        recordDrop(ctx, `MixedField:${f.type}`);
        continue;
      }
      const v = astToJsValue(f.value, withPath(ctx, `[${i}]`));
      if (v === DROP) continue;
      arr.push(v);
    }
    return arr;
  }

  const obj: Record<string, unknown> = {};
  let arrayIndex = 1;
  for (const f of fields) {
    const { key, value } = resolveField(f, arrayIndex);
    if (f.type === "TableValue") arrayIndex++;
    if (key === DROP) continue;

    const keyStr = String(key);
    if (ctx.skipKeys.has(keyStr)) {
      ctx.diag.skippedKeys.set(keyStr, (ctx.diag.skippedKeys.get(keyStr) ?? 0) + 1);
      continue;
    }

    const v = astToJsValue(value, withPath(ctx, keyStr));
    if (v === DROP) continue;
    obj[keyStr] = v;
  }
  return obj;
}

function resolveField(
  f: TableField,
  fallbackIndex: number,
): { key: string | number | Drop; value: Expression } {
  if (f.type === "TableKeyString") {
    return { key: f.key.name, value: f.value };
  }
  if (f.type === "TableKey") {
    const k = f.key;
    if (k.type === "StringLiteral") return { key: latin1ToUtf8(k.value), value: f.value };
    if (k.type === "NumericLiteral") return { key: k.value, value: f.value };
    return { key: DROP, value: f.value };
  }
  return { key: fallbackIndex, value: f.value };
}

function withPath(ctx: AstContext, segment: string): AstContext {
  return { ...ctx, path: ctx.path ? `${ctx.path}.${segment}` : segment };
}

function recordDrop(ctx: AstContext, kind: string) {
  ctx.diag.droppedCalls++;
  if (ctx.diag.droppedSamples.length < 5) {
    ctx.diag.droppedSamples.push(`${ctx.path || "<root>"}: ${kind}`);
  }
}

export const __INTERNAL = { DROP };
