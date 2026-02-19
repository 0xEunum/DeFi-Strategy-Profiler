import { type Runtime, type HTTPPayload } from "@chainlink/cre-sdk";
import type { Config } from "./Config.ts";

export const onHttpTrigger = (
  runtime: Runtime<Config>,
  payload: HTTPPayload,
) => {
  runtime.log("HTTP-CALLBACK FUNCTION");
  if (!payload.input || payload.input.length === 0) {
    return "Empty payload";
  }
  runtime.log(JSON.stringify(payload));
  return "Run";
};
