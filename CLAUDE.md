# WikiWeb (ehemals WikiGraph)

Mobile Web-App zum Wikipedia-Lesen: Alles, was man liest, wird als Graph à la Obsidian gespeichert, um Wissen zu entdecken und zu verknüpfen.

- Live: https://wikiweb.vercel.app (Hauptadresse, mit GitHub-Login für Sync) und https://frechmax.github.io/wikigraph/ (GitHub Pages, ohne Login-Funktion)
- Repo: `frechmax/wikigraph`, Branch `main` wird von beiden automatisch deployt.

## Über den Nutzer
- Max (TU Berlin, Bauinformatik) nutzt die App **vor allem am Handy** (Chrome), manchmal am Laptop. Er arbeitet an der App ebenfalls fast nur vom Handy aus.
- Kommunikation **auf Deutsch**, kurz und direkt, ohne lange Einleitungen. Englische Fachbegriffe sind ok.
- Er testet selbst am Handy; ehrlich sagen, was nur simuliert getestet wurde.
- Bisheriger Ablauf: Änderung umsetzen, prüfen, direkt auf `main` committen und pushen, dann kurz berichten (was geändert, was nur simuliert getestet). Vorher immer `git pull --ff-only`, weil oft mehrere Sessions parallel pushen.

## Aufbau
Keine Build-Schritte, keine Frameworks. Alles Vanilla HTML/CSS/JS.

| Datei | Inhalt |
|---|---|
| `index.html` | Die komplette App (~3700 Zeilen): CSS oben, HTML, dann ein großes `<script>`. Abschnitte sind mit `/* ---------- Name ---------- */` markiert (`grep -n "^/\* ----------" index.html`). |
| `sw.js` | Service Worker: Shell + Artikel + Vorschauen + Clickstream network-first; Bilder cache-first (nur wenn „mit Bildern“ an). Einstellungen kommen per `postMessage({type:'cfg'})` und liegen im Cache `wg-v1-cfg`. |
| `manifest.webmanifest`, `icons/` | PWA (installierbar, `share_target`). Icon-Variante 3 (Zickzack), Cache-Buster `?v=4`. |
| `api/github-auth.js` | Vercel Edge Function: leitet den GitHub Device Flow weiter (GitHub erlaubt dafür kein CORS). Env: `CLIENT_ID`, optional `CLIENT_SECRET` (nur für Token-Refresh). Auf github.io nicht verfügbar → dort nur manueller Token. |
| `scripts/clickstream.py` + `.github/workflows/clickstream.yml` | Monatlich: Wikipedia-Clickstream (de, en) → Top-K-Folgeartikel pro Artikel, aufgeteilt in 4096 Shards (FNV-1a des UTF-8-Titels) auf Branch `clickstream`, geladen über raw.githubusercontent.com. Schwellen: de TOPK 10 / MIN_N 15, en TOPK 8 / MIN_N 10. |
| `data/countries-110m.json` | Ländergrenzen (Natural Earth via world-atlas, TopoJSON) für die Kartenansicht. |
| `tests/` | jsdom-Smoke-Tests (s. u.). |

## Wichtige Konzepte im Code
- **Routing** über Hash: `#search`, `#a/<lang>/<Titel>`, `#graph`, `#notes`, `#more`, `#url=…` (geteilte Wikipedia-Links).
- **Speicher:** `db` in IndexedDB (Schlüssel `main`, Graph-Positionen separat unter `pos`), Fallback localStorage. `save()` erhöht `dbRev` → Memos (`analyze`, `sameMap`) invalidieren sich darüber.
  - `db.nodes['lang:Titel'] = {title, lang, visits[], first, last, out[], qid, desc, ll{lang:titel}, later, cs}`
  - `db.edges` (Navigation f→t mit ts), `db.alias` (Redirects), `db.hl` (Markierungen pro Artikel), `db.view` (`VW()`), `db.rank` (`RK()`), `db.facts` (Wikidata-Orte/Jahre), `db.near`, `db.offline`.
- **Schlüssel auflösen:** `K(lang,title)`; `resolveA(k)` = nur Redirects (gleiche Sprache); `resolve(k)` = Redirects **plus** Sprach-Zusammenführung (gleiche Wikidata-QID / bekannte Sprachlinks → ein Hauptknoten, der zuerst gelesene). `grp(main)` liefert alle Sprachversionen. Für sprachspezifische Dinge (Seiten-Cache, Leseposition `posStore`, Markierungen) **`resolveA`/exakte Keys** verwenden, für Graph-Identität `resolve`.
- **Graph:** `analyze()` (memoisiert) → Links: `nav` (geklickt), `sem` (Artikel verlinken sich), `wd` (Wikidata-Beziehung), `ghost` (Vorschläge). Vorschläge-Score aus Links (Adamic-Adar, standardmäßig aus), Markierungen ×3, Clickstream ×3. `rebuild()` baut `G.nodes/G.links`, Cluster per Label Propagation (`computeClusters`). Canvas-Rendering in `draw()`, Physik in `tick()` (Kollision, Themen-Inseln, Entwirren mit `G.boost`).
- **Layouts** (`VW().layout`): `net` (Kraftlayout, Positionen persistiert), `time` (Lesezeit), `map` (Wikidata-Koordinaten, Mercator `proj()`, Knoten fixe Bildschirmgröße `geoNr`), `hist` (Jahreszahlen, log-Zeitachse `HX`). In `map`/`hist` gilt `G.geo`, nur Knoten mit `tx` sind sichtbar (`shown`).
- **Sync:** privates GitHub-Gist, Inhalt `canon()` (stabile Key-Reihenfolge) + gzip. `mergeData()` ist kommutativ: Visits als Vereinigung, sonstige Felder deterministischer Gewinner; Löschungen über Tombstones (`del`, `ndel`, `resetTs`). Neue Felder, die man auch *entfernen* kann, brauchen eine eigene Merge-Regel (Beispiel `later`: Zeitstempel, negativ = entfernt, größter Betrag gewinnt).
- **Offline:** Artikel werden automatisch gecacht (max. 600, mit „alle speichern“ unbegrenzt). Bilder mit `mode:'cors'` speichern (sonst opake Antworten mit riesiger Quota-Größe). Offline fällt der SW auf eine andere gespeicherte Größe desselben Bildes zurück.

## Konventionen
- UI-Texte auf Deutsch, kurz. Neue Bedienelemente an bestehende Stile anlehnen (`.chip`, `.btn.sec`, `.icobtn`, Bottom-Sheet `#pop`/`#popbody`, Infokarte `#sheet`), nicht neue Button-Typen erfinden.
- Kommentare im Code auf Englisch, knapp, warum statt was.
- Mobile first: Touch-Ziele ≥ 34 px, nichts nur per Hover; Laptop-Extras (Hover-Vorschau, Strg+Enter) nur zusätzlich.
- Nichts an Daten ohne Not migrieren; wenn doch, einmalig mit Flag (z. B. `db.rank.m1`, `db.offline.imgV`).
- Keine externen Bibliotheken außer bei Bedarf per CDN (JSZip für den Obsidian-Export).

## Prüfen & Testen
```bash
npm i            # einmalig, nur jsdom für die Tests
npm run check    # Syntax von index.html-Script und sw.js
npm test         # check + jsdom-Smoke-Tests (Graph-Layouts, Sprachwechsel)
```
- Die Tests geben Zustände aus statt hart zu asserten; ein `EXC`/`ERR` in der Ausgabe = kaputt.
- Für Optik: Headless Chrome mit Screenshot in Handy-Breite, z. B. eine Kopie von `index.html` mit einem Seed-Script vor `</body>`, das `db` füllt, und `google-chrome --headless=new --window-size=390,844 --virtual-time-budget=5000 --screenshot=out.png http://localhost:8765/index.html`.
- Externe APIs (Wikipedia, Wikidata, OpenStreetMap Nominatim, OpenAlex) sind aus der Sandbox oft nicht erreichbar → in Tests `fetch` stubben und das dem Nutzer sagen.

## Stolperfallen (schon passiert)
- Beim Einfügen per Script keine `// Kommentare` mitten in eine Zeile setzen, die danach noch Code hat.
- Nach Änderungen an `analyze`/Keys immer an Sprach-Zusammenführung denken (`C()`/`resolve` vs. `resolveA`).
- Der Service Worker hat keinen Versionssprung nötig (network-first), aber Änderungen an `sw.js` greifen erst nach dem nächsten Laden.
- Koordinaten von anderen Himmelskörpern (`<…Q405> Point(…)`) und Mehrfach-Orte (z. B. Kriege) werden bewusst ignoriert.
