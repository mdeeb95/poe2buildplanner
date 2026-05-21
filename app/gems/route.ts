import path from "node:path";
import { createJsonDataRoute } from "@/lib/data/stream-json-route";

const GEMS_PATH = path.join(process.cwd(), "data", "gems.json");

export const GET = createJsonDataRoute(GEMS_PATH);
