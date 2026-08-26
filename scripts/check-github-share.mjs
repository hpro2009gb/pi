#!/usr/bin/env node

const allowValue = process.env.PI_ALLOW_GITHUB_SHARE;
const allowed = allowValue === "1" || allowValue === "true" || allowValue === "yes";

if (allowed) {
	process.exit(0);
}

console.error("git push blocked: GitHub share is off until the owner allows it.");
console.error("Local git commit is fine. Do not push OPM/Super Pi until they say chia sẻ / share / push.");
console.error("Then: PI_ALLOW_GITHUB_SHARE=1 git push ...");
process.exit(1);
