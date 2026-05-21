import path from "node:path";
import { createJsonDataRoute } from "@/lib/data/stream-json-route";

const TREE_PATH = path.join(process.cwd(), "data", "tree.json");

export const GET = createJsonDataRoute(TREE_PATH);
