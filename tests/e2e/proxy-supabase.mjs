// Udaje adres Supabase dla lokalnej repliki:
//   /rest/v1/*  -> PostgREST
//   /auth/v1/*  -> minimalna atrapa GoTrue (logowanie hasłem, sesja, zaproszenie,
//                  jednorazowy link, zmiana hasła) na tabeli auth.users w replice.
// Tylko do testów — hasła leżą w bazie jawnym tekstem.
import http from "node:http";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";

const SEKRET = "e2e-lokalny-sekret-jwt-dla-testow-min-32-znaki";
const PSQL = process.env.E2E_PSQL ?? "psql -h 127.0.0.1 -p 54322 -U postgres -d beauty";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const podpis = (dane) => createHmac("sha256", SEKRET).update(dane).digest("base64url");
const jwt = (tresc) => {
  const naglowek = b64({ alg: "HS256", typ: "JWT" });
  const t = b64(tresc);
  return `${naglowek}.${t}.${podpis(`${naglowek}.${t}`)}`;
};
const odczytajJwt = (token) => {
  const [n, t, p] = String(token ?? "").split(".");
  if (!n || !t || p !== podpis(`${n}.${t}`)) return null;
  const tresc = JSON.parse(Buffer.from(t, "base64url").toString());
  return tresc.exp && tresc.exp * 1000 < Date.now() ? null : tresc;
};

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const sql = (zapytanie) =>
  execSync(`${PSQL} -tA -F'|' -c ${JSON.stringify(zapytanie)}`, { encoding: "utf-8" }).trim();
const uzytkownikPoEmail = (email) => {
  const w = sql(`select id, email, coalesce(encrypted_password,'') from auth.users where lower(email)=lower(${q(email)})`);
  if (!w) return null;
  const [id, em, haslo] = w.split("|");
  return { id, email: em, haslo };
};
const uzytkownikPoId = (id) => {
  const w = sql(`select id, email from auth.users where id=${q(id)}`);
  if (!w) return null;
  const [uid, email] = w.split("|");
  return { id: uid, email };
};

const obiektUzytkownika = (u) => ({
  id: u.id,
  aud: "authenticated",
  role: "authenticated",
  email: u.email,
  email_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: new Date().toISOString(),
});
const sesja = (u) => {
  const teraz = Math.floor(Date.now() / 1000);
  return {
    access_token: jwt({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", iat: teraz, exp: teraz + 86400 }),
    token_type: "bearer",
    expires_in: 86400,
    expires_at: teraz + 86400,
    refresh_token: `rt.${u.id}`,
    user: obiektUzytkownika(u),
  };
};

/** Jednorazowe tokeny z generate_link: token -> { userId, typ } */
const tokeny = new Map();

const wyslij = (res, kod, cialo) => {
  if (cialo === undefined) {
    res.writeHead(kod);
    return res.end();
  }
  res.writeHead(kod, { "content-type": "application/json" });
  res.end(JSON.stringify(cialo));
};
const blad = (res, kod, kodBledu, msg) => wyslij(res, kod, { code: kod, error_code: kodBledu, msg });

async function auth(req, res, url, cialo) {
  const sciezka = url.pathname.replace(/^\/auth\/v1/, "");
  const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const token = odczytajJwt(bearer);

  if (sciezka === "/health") return wyslij(res, 200, { name: "GoTrue (atrapa E2E)" });

  if (sciezka === "/token" && req.method === "POST") {
    const typ = url.searchParams.get("grant_type");
    if (typ === "password") {
      const u = uzytkownikPoEmail(cialo.email ?? "");
      if (!u || !u.haslo || u.haslo !== cialo.password) return blad(res, 400, "invalid_credentials", "Invalid login credentials");
      sql(`update auth.users set last_sign_in_at=now() where id=${q(u.id)}`);
      return wyslij(res, 200, sesja(u));
    }
    if (typ === "refresh_token") {
      const u = uzytkownikPoId(String(cialo.refresh_token ?? "").replace(/^rt\./, ""));
      return u ? wyslij(res, 200, sesja(u)) : blad(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
    }
    return blad(res, 400, "unsupported_grant_type", "unsupported grant");
  }

  if (sciezka === "/user") {
    if (!token?.sub) return blad(res, 401, "bad_jwt", "invalid JWT");
    const u = uzytkownikPoId(token.sub);
    if (!u) return blad(res, 404, "user_not_found", "User not found");
    if (req.method === "PUT") {
      if (cialo.password) sql(`update auth.users set encrypted_password=${q(cialo.password)} where id=${q(u.id)}`);
      return wyslij(res, 200, obiektUzytkownika(u));
    }
    return wyslij(res, 200, obiektUzytkownika(u));
  }

  if (sciezka === "/logout") return wyslij(res, 204);

  if (sciezka === "/verify" && req.method === "POST") {
    const wpis = tokeny.get(cialo.token_hash);
    if (!wpis || wpis.typ !== cialo.type) return blad(res, 403, "otp_expired", "Email link is invalid or has expired");
    tokeny.delete(cialo.token_hash); // jednorazowy
    return wyslij(res, 200, sesja(uzytkownikPoId(wpis.userId)));
  }

  if (sciezka === "/admin/generate_link" && req.method === "POST") {
    if (token?.role !== "service_role") return blad(res, 403, "not_admin", "User not allowed");
    let u = uzytkownikPoEmail(cialo.email ?? "");
    if (cialo.type === "invite") {
      if (u) return blad(res, 422, "email_exists", "A user with this email address has already been registered");
      const id = randomUUID();
      sql(`insert into auth.users (id, email) values (${q(id)}, lower(${q(cialo.email)}))`);
      u = uzytkownikPoId(id);
    } else if (cialo.type === "recovery") {
      if (!u) return blad(res, 404, "user_not_found", "User not found");
    } else {
      return blad(res, 400, "validation_failed", "unsupported link type");
    }
    const hashed = randomBytes(24).toString("hex");
    tokeny.set(hashed, { userId: u.id, typ: cialo.type });
    return wyslij(res, 200, {
      ...obiektUzytkownika(u),
      action_link: `http://127.0.0.1:54321/auth/v1/verify?token=${hashed}&type=${cialo.type}`,
      email_otp: "000000",
      hashed_token: hashed,
      verification_type: cialo.type,
      redirect_to: "",
    });
  }

  return blad(res, 404, "not_found", `atrapa GoTrue nie obsługuje ${req.method} ${sciezka}`);
}

http
  .createServer((req, res) => {
    if (req.url.startsWith("/rest/v1")) {
      const cel = req.url.replace(/^\/rest\/v1/, "") || "/";
      const p = http.request(
        { host: "127.0.0.1", port: 54330, path: cel, method: req.method, headers: req.headers },
        (r) => {
          res.writeHead(r.statusCode, r.headers);
          r.pipe(res);
        },
      );
      p.on("error", (e) => {
        res.writeHead(502);
        res.end(String(e));
      });
      req.pipe(p);
      return;
    }
    if (req.url.startsWith("/auth/v1")) {
      // Przeglądarka loguje się bezpośrednio do Supabase — jak prawdziwy GoTrue odpowiadamy na CORS.
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] ?? "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      if (req.method === "OPTIONS") return wyslij(res, 204);
      let dane = "";
      req.on("data", (k) => (dane += k));
      req.on("end", () => {
        let cialo = {};
        try {
          cialo = dane ? JSON.parse(dane) : {};
        } catch {
          /* puste albo nie-JSON */
        }
        auth(req, res, new URL(req.url, "http://127.0.0.1"), cialo).catch((e) => blad(res, 500, "unexpected_failure", String(e)));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  })
  .listen(54321, "127.0.0.1", () => console.log("proxy na 54321 (PostgREST + atrapa GoTrue)"));
