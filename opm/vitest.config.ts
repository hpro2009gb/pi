import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig, { workspaceSourcePaths } from "../vitest.base.ts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default mergeConfig(
	baseConfig,
	defineConfig({
		server: {
			fs: {
				allow: [repoRoot],
			},
		},
		test: {
			environment: "node",
			include: ["test/**/*.test.ts"],
			testTimeout: 30000,
			env: { PI_OFFLINE: "1" },
			unstubEnvs: true,
		},
		resolve: {
			alias: [
				{ find: /^@earendil-works\/pi-coding-agent$/, replacement: workspaceSourcePaths.codingAgentIndex },
				{
					find: /^@earendil-works\/pi-client$/,
					replacement: fileURLToPath(new URL("../packages/client/src/index.ts", import.meta.url)),
				},
				{
					find: /^@earendil-works\/pi-protocol$/,
					replacement: fileURLToPath(new URL("../packages/protocol/src/index.ts", import.meta.url)),
				},
			],
		},
	}),
);
