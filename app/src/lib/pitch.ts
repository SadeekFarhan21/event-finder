// A first-draft pitch email for Yelo's partner team: subject and body built from what Scout knows
// about the room. Plain and short; the team edits it in their mail app before sending.
import type { Lead } from "./types";

export function pitchEmail(l: Pick<Lead, "venue" | "quietNight" | "capacity">, city: string, riderViews = 0) {
  const town = city.split(",")[0];
  const night = l.quietNight ? `${l.quietNight}s` : "a quieter weeknight";
  const lines = [
    `Hi ${l.venue} team,`,
    "",
    `I'm with Yelo, the rideshare for students and twenty-somethings in ${town}. We partner with independent venues to fill a quiet night: we build the event with you and bring our riders to your door.`,
    "",
    `${l.venue} looks like a great fit${l.capacity ? ` (${l.capacity.replace(/^Up to/i, "up to")} people)` : ""}, and ${night} could be a good night to start.`,
  ];
  if (riderViews > 0) lines.push("", `Riders on Scout, our discovery app, already looked at your nights ${riderViews === 1 ? "once" : `${riderViews} times`} this week.`);
  lines.push("", "Would you be open to a quick call this week?", "", "Thanks,");
  return { subject: `A Yelo night at ${l.venue}`, body: lines.join("\n") };
}
