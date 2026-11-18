"use client";
import { useState } from "react";
import { useToast } from "./ui";

/** Contoh siap salin untuk menyambungkan perangkat. Token hanya diisi bila baru dibuat. */
export function IotGuide({ token }: { token?: string }) {
  const toast = useToast();
  const [tab, setTab] = useState<"curl" | "nodered" | "esp32">("curl");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const tk = token ?? "TOKEN_PERANGKAT";
  const SNIP = {
    curl: `curl -X POST ${origin}/api/iot/v1/readings \\
  -H "Authorization: Bearer ${tk}" \\
  -H "Content-Type: application/json" \\
  -d '{"temperature": 28.4, "humidity": 70, "ammonia": 11}'`,
    nodered: `1. Tambah node "http request": Method POST, URL ${origin}/api/iot/v1/readings,
   Return: "a parsed JSON object".
2. Tab Headers: Authorization = Bearer ${tk}
   (Content-Type: application/json otomatis bila msg.payload berupa objek).
3. Sebelumnya, node "function" menyusun data:
   msg.payload = { temperature: 28.4, humidity: 70 };
   return msg;
4. Untuk perintah dari server: node "inject" tiap 10 detik -> "http request"
   GET ${origin}/api/iot/v1/commands (header sama), lalu balas tiap perintah
   dengan POST ${origin}/api/iot/v1/commands/<id>/ack.
Flow siap impor ada di docs/nodered-flow.json pada repo.`,
    esp32: `// ESP32 (Arduino) - kirim suhu & kelembapan tiap 30 detik
#include <WiFi.h>
#include <HTTPClient.h>
const char* URL = "${origin}/api/iot/v1/readings";
const char* TOKEN = "${tk}";
void kirim(float t, float h) {
  HTTPClient http;
  http.begin(URL);
  http.addHeader("Authorization", String("Bearer ") + TOKEN);
  http.addHeader("Content-Type", "application/json");
  String body = String("{\\"temperature\\":") + t + ",\\"humidity\\":" + h + "}";
  int code = http.POST(body);   // 201 = berhasil
  http.end();
}`,
  } as const;
  return (
    <div>
      <div className="seg" role="tablist">{(["curl", "nodered", "esp32"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{k === "curl" ? "curl / HTTP" : k === "nodered" ? "Node-RED" : "ESP32"}</button>)}</div>
      <pre style={{ background: "var(--surface-2, #f3f5f4)", padding: 12, borderRadius: 8, overflowX: "auto", fontSize: 12, marginTop: 8, whiteSpace: "pre-wrap" }}>{SNIP[tab]}</pre>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { void navigator.clipboard.writeText(SNIP[tab]).then(() => toast({ kind: "ok", title: "Disalin" })).catch(() => undefined); }}>Salin contoh</button>
    </div>
  );
}
