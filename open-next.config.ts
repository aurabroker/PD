import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Bez konfiguracji cache: wszystkie trasy z danymi sa dynamiczne
 * (`force-dynamic`), wiec ISR ani cache przyrostowy nie sa uzywane.
 */
export default defineCloudflareConfig();
