import { cre, Runner } from "@chainlink/cre-sdk";
import type { Config } from "./types.js";
import { onHttpTrigger } from "./httpCallback";

// 3. The Handler: Linking trigger to callback
export const initWorkflow = (config: Config) => {
  const http = new cre.capabilities.HTTPCapability();
  const httpTrigger = http.trigger({});

  return [cre.handler(httpTrigger, onHttpTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
