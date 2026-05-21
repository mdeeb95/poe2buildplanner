import path from "node:path";
import { createJsonDataRoute } from "@/lib/data/stream-json-route";

const BASES_PATH = path.join(process.cwd(), "data", "bases.json");

export const GET = createJsonDataRoute(BASES_PATH);
