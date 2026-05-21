import path from "node:path";
import { createJsonDataRoute } from "@/lib/data/stream-json-route";

const TREE_ART_PATH = path.join(process.cwd(), "data", "tree-art.json");

export const GET = createJsonDataRoute(TREE_ART_PATH);
