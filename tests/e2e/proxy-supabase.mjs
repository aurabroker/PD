// Udaje adres Supabase: /rest/v1/* -> PostgREST, /auth/v1/* -> 401 (brak sesji).
import http from "node:http";
http.createServer((req, res) => {
  if (req.url.startsWith("/rest/v1")) {
    const cel = req.url.replace(/^\/rest\/v1/, "") || "/";
    const p = http.request({ host: "127.0.0.1", port: 54330, path: cel, method: req.method, headers: req.headers },
      (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    p.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
    req.pipe(p);
    return;
  }
  if (req.url.startsWith("/auth/v1")) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ code: 401, msg: "brak sesji (lokalna replika)" }));
    return;
  }
  res.writeHead(404); res.end();
}).listen(54321, "127.0.0.1", () => console.log("proxy na 54321"));
