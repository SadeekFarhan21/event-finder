// Run the agent from the terminal: npm run discover -- "Austin, TX"
import { discover } from "../supabase/functions/_shared/discover.ts";
import { nodeDeps } from "./node-deps.ts";
const city = process.argv[2] ?? "New York, NY";
const events = await discover(city, nodeDeps(console.log));
console.table(events.map((e) => ({ title: e.title.slice(0, 40), venue: e.venue.slice(0, 25), start: e.start?.slice(0, 16), cat: e.category, conf: e.confidence })));
