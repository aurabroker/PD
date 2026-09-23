/**
 * Generuje klucze anon i service_role dla lokalnej repliki - podpisane tym samym
 * sekretem, ktory dostaje PostgREST (tests/e2e/postgrest.conf).
 * Uzycie: node tests/e2e/klucze-jwt.mjs > .env.e2e
 */
import { createHmac } from "node:crypto";

const SEKRET = "e2e-lokalny-sekret-jwt-dla-testow-min-32-znaki";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const podpisz = (rola) => {
  const naglowek = b64({ alg: "HS256", typ: "JWT" });
  const tresc = b64({ iss: "supabase", role: rola, iat: 1700000000, exp: 2100000000 });
  const podpis = createHmac("sha256", SEKRET).update(`${naglowek}.${tresc}`).digest("base64url");
  return `${naglowek}.${tresc}.${podpis}`;
};

console.log("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321");
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${podpisz("anon")}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY=${podpisz("service_role")}`);
