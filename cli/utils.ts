import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Root .env is one level up from cli/
const ENV_PATH = path.resolve(__dirname, "../.env");
dotenv.config({ path: ENV_PATH });

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`✗ Missing env var: ${key}`);
    process.exit(1);
  }
  return value;
}

// Writes "KEY=value" into root .env in-place
export function writeEnv(key: string, value: string): void {
  let content = fs.readFileSync(ENV_PATH, "utf-8");
  const regex = new RegExp(`^(${key}=).*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `$1${value}`); // replaces after the =
  } else {
    content += `\n${key}=${value}`;
  }
  fs.writeFileSync(ENV_PATH, content);
}
