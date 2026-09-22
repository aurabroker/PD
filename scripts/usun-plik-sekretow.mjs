/** Kasuje tymczasowy plik sekretow po deployu, niezaleznie od jego wyniku. */
import { rmSync } from "node:fs";
rmSync(".wrangler-sekrety.json", { force: true });
