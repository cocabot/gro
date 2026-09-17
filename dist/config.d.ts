import type { PackgateConfig } from "./types.js";
export declare const DEFAULT_DENY: readonly ["**/.env", "**/.env.*", "!**/.env.example", "!**/.env.sample", "!**/.env.template", "!**/.env.test", "!**/.env.testing", "**/*.pem", "**/*.p12", "**/*.pfx", "**/*.key", "**/*.keystore", "**/id_rsa", "**/id_ed25519", "**/.npmrc", "**/.pypirc", "**/.aws/credentials", "**/credentials.json", "**/service-account*.json", "**/.git", "**/.git/**"];
export declare const DEFAULT_REQUIRE: readonly ["LICENSE", "README.md"];
export declare function defaultConfig(): PackgateConfig;
export declare function loadConfig(cwd: string, configPath?: string, overrides?: Partial<PackgateConfig>): PackgateConfig;
