import path from "node:path";
import { createJsonDataRoute } from "@/lib/data/stream-json-route";

const UNIQUES_PATH = path.join(process.cwd(), "data", "uniques.json");

export const GET = createJsonDataRoute(UNIQUES_PATH);
