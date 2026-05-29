import path from "node:path";
import { createJsonDataRoute } from "@/lib/data/stream-json-route";

const GEM_STAT_BLOCKS_PATH = path.join(process.cwd(), "data", "gem-stat-blocks.json");

export const GET = createJsonDataRoute(GEM_STAT_BLOCKS_PATH);
