# Backend implementacioni vodič (zvanično): Async generisanje CFG iz jednog fajla pomoću Joern (warm) + FastAPI + Redis + RQ

Ovaj dokument definiše tačnu arhitekturu i implementacione korake za backend koji:
- prima **jedan fajl izvornog koda** (C/C++/Java/Python/JavaScript),
- fajl može doći iz **web editora** (copy/paste ili kucanje direktno u frontend-u) **ili** kao **upload** fajla,
- **asinkrono** generiše **Control Flow Graph (CFG)** korišćenjem **Joern**,
- koristi **FastAPI** kao HTTP API, **Redis** kao queue + skladište rezultata, i **RQ** kao job sistem,
- koristi **warm Joern proces + skriptovanje** (bez cold-start poziva Joern CLI-ja po zahtevu),
- vraća **202 sa praznim telom** kada rezultat još nije spreman,
- vraća **404** kada `jobId` ne postoji,
- skladišti rezultate u **Redis** (sa TTL).

> DevOps i deploy koraci nisu deo ovog dokumenta.

---

## 1) Terminologija i uloge komponenti

### Komponente
1. **FastAPI aplikacija (API servis)**
   - kreira jobove i vraća `jobId`
   - obezbeđuje polling endpoint-e za status i rezultat

2. **Redis**
   - broker/queue backend za RQ
   - skladište za:
     - status joba,
     - rezultat CFG-a (JSON),
     - greške i log “tail” (opciono).

3. **RQ Worker**
   - izvršava “generate_cfg” jobove
   - komunicira sa **warm Joern servisom** (lokalno) radi ekstrakcije CFG-a.

4. **Warm Joern servis**
   - dugovečni proces koji ostaje upaljen
   - izvršava skripte/upite nad CPG-om i vraća CFG u standardizovanom formatu
   - API/worker nikada ne pokreće kompletnu JVM instancu “iz početka” po jobu.

---

## 2) Funkcionalni zahtevi (zaključani)

### Ulaz
- Jedan fajl (string) + eksplicitan jezik:
  - `language ∈ { c, cpp, java, python, javascript }`
- Fajl se može dostaviti na dva načina:
  1) **Web editor**: frontend šalje sadržaj fajla u polju `source` (copy/paste ili kucanje).
  2) **Upload fajla**: frontend upload-uje fajl backend-u, backend iz njega čita sadržaj i tretira ga identično kao editor input.
- Opcioni `filename` (npr. `main.c`) koristi se samo za ekstenziju i debug.

### Izlaz
- Jedan CFG u kanonskom JSON formatu (definisan u odeljku 6).

### Protokol za “rezultat nije spreman”
- `GET /cfg/jobs/{jobId}/result`
  - ako je job **queued/running** → **202 Accepted** sa **praznim telom**
  - ako je job **completed** → **200 OK** sa JSON rezultatom
  - ako job **ne postoji** → **404 Not Found**
  - ako je job **failed** → **200 OK** sa JSON error payload-om (definisano u odeljku 7)

> Ovim se izbegava korišćenje 4xx kodova za očekivani “nije spremno” scenario.

---

## 3) API specifikacija (FastAPI)

Backend mora podržati **dva načina** slanja izvornog fajla: JSON body (editor) i multipart upload (fajl upload). Oba načina moraju proizvoditi isti `jobId` i isti pipeline.

### 3.1 Kreiranje posla (web editor): `POST /cfg/jobs`
Kreira job i odmah vraća `jobId`.

**Request body**
```json
{
  "language": "c|cpp|java|python|javascript",
  "filename": "main.c",
  "source": "int main() { return 0; }"
}
```

**Response: 202 Accepted**
```json
{
  "jobId": "01J...ULID"
}
```

---

### 3.2 Kreiranje posla (upload fajla): `POST /cfg/jobs/upload`
Kreira job na osnovu upload-ovanog fajla i odmah vraća `jobId`.

**Request (multipart/form-data)**
- `language`: string (`c|cpp|java|python|javascript`)
- `file`: binary upload (izvorni fajl)
- `filename` se čita iz `file` metapodatka; backend ga sanitizuje i može ga ignorisati ako nije bezbedan.

**Response: 202 Accepted**
```json
{
  "jobId": "01J...ULID"
}
```

> Napomena: Ako frontend već ima sadržaj fajla (npr. drag&drop pa čitanje u browser-u), dozvoljeno je da uvek koristi `POST /cfg/jobs` i šalje `source`. Ali backend mora podržati i direktan upload jer je to eksplicitni zahtev.

---

### 3.3 Status: `GET /cfg/jobs/{jobId}`
Vraća stanje posla i eventualno grešku.

**Response: 200 OK**
```json
{
  "jobId": "01J...ULID",
  "status": "queued|running|completed|failed",
  "stage": "queued|writing-source|joern|extract|normalize|done",
  "createdAt": "2026-04-01T12:00:00.000Z",
  "startedAt": "2026-04-01T12:00:01.000Z",
  "finishedAt": null,
  "error": null
}
```

**Ako job ne postoji:** `404 Not Found`

---

### 3.4 Rezultat: `GET /cfg/jobs/{jobId}/result`
**Scenario A:** job postoji ali nije gotov → `202` prazno telo  
**Scenario B:** job gotov → `200` sa CFG JSON  
**Scenario C:** job ne postoji → `404`  
**Scenario D:** job failed → `200` sa error JSON

---

## 4) Validacija i limiti (obavezno)

Validacije se rade:
- u API sloju (pre enqueue),
- i ponovo u worker-u (defanzivno).

Minimum:
- `source` non-empty
- maksimalna veličina `source` (preporuka): 200 KB
- maksimalan broj linija (preporuka): 5000
- `language` mora biti jedna od dozvoljenih vrednosti
- `filename` sanitize (zabraniti `..`, `\0`, apsolutne putanje)

Timeout:
- hard timeout po job-u: npr. 20s

---

## 5) Identitet posla i ključevi u Redis-u

### 5.1 jobId
Koristi ULID ili UUIDv4. ULID je zgodan jer je vremenski sortabilan.

### 5.2 Redis ključevi (konvencija)
Za `jobId = <id>`:

- `cfg:job:<id>:meta` — JSON meta (status, timing, stage, language, filename, sourceHash)
- `cfg:job:<id>:result` — JSON rezultat (CFG JSON) **ili** JSON error payload
- `cfg:job:<id>:logtail` — poslednjih N karaktera stderr/stdout (opciono)

### 5.3 TTL
Svi ključevi imaju TTL (npr. 1 sat ili 24h). TTL se postavlja:
- pri kreiranju posla (meta),
- ponovo pri upisu rezultata (result).

---

## 6) RQ: job model i worker

### 6.1 RQ queue
- Queue name: `cfg`
- Worker concurrency: 1 (početno)

### 6.2 Payload koji se stavlja u queue
```python
@dataclass
class CfgJobPayload:
    job_id: str
    language: Literal["c","cpp","java","python","javascript"]
    filename: str
    source: str
    created_at: str  # ISO
    source_hash: str # sha256
```

### 6.3 Stage updates (obavezno)
Worker mora ažurirati `meta.stage`:
- `writing-source`
- `joern`
- `extract`
- `normalize`
- `done`

---

## 7) Kanonski CFG JSON format (backend → frontend ugovor)

Backend uvek vraća ovaj format kada je job `completed`:

```json
{
  "version": "cfg-json-1",
  "language": "c",
  "filename": "main.c",
  "sourceHash": "sha256:...",
  "graph": {
    "entryNodeId": "n0",
    "exitNodeId": "n42",
    "nodes": [
      {
        "id": "n0",
        "kind": "entry|exit|stmt|branch|merge|call|return|unknown",
        "label": "ENTRY",
        "range": null
      }
    ],
    "edges": [
      {
        "from": "n0",
        "to": "n1",
        "kind": "next|branch",
        "label": ""
      }
    ]
  }
}
```

---

## 8) Error payload format (job failed)

Kada job postoji ali je failed, `GET /cfg/jobs/{jobId}/result` vraća **200 OK** sa:

```json
{
  "version": "cfg-error-1",
  "jobId": "01J...ULID",
  "code": "JOERN_FAILED|UNSUPPORTED_LANGUAGE|SYNTAX_ERROR|TIMEOUT|INTERNAL_ERROR",
  "message": "Human readable message",
  "stage": "writing-source|joern|extract|normalize",
  "details": {
    "stderrTail": "...",
    "hint": "..."
  }
}
```

---

## 9) Warm Joern proces + skriptovanje (definitivno)

Cilj: **Joern runtime je stalno upaljen**, a worker mu šalje zahteve tako da se JVM ne restartuje po jobu.

### 9.1 Interfejs između worker-a i Joern-a
Koristi se model: **lokalni HTTP servis**.

- Warm Joern proces izlaže lokalni HTTP endpoint (npr. `127.0.0.1:<port>`).
- Worker šalje:
  - `POST /analyze` sa `{ jobId, language, path, filename }`
- Dobija:
  - `{ cfgDot: "..." }` ili `{ cfgJson: {...} }`

Ako Joern ne nudi server API direktno, implementira se **wrapper servis**:
- wrapper drži Joern shell “warm”,
- prima HTTP zahteve,
- izvršava Joern skriptu za analizu i vraća rezultat.

---

## 10) Odabir entry tačke (definitivna heuristika)

1. C/C++: `main` ako postoji, inače prva definisana funkcija
2. Java: `public static void main(String[] args)` ako postoji, inače prva metoda
3. Python: prva `def` funkcija (ako nema, fail)
4. JavaScript: top-level flow ako postoji, inače prva `function`

---

## 11) Worker pipeline (tačan redosled)

1) validacija  
2) `writing-source` (temp dir + upis fajla)  
3) `joern` (poziv warm Joern servisa, timeout)  
4) `extract` (DOT/JSON u graf)  
5) `normalize` (id-ovi, label-e, entry/exit)  
6) `store` (Redis result + meta update + TTL)  
7) cleanup (brisanje temp dir-a)

Greške:
- upis `cfg-error-1` u `result`
- status `failed`

---

## 12) Integracija sa postojećim Angular Knuth vizualizatorom

Backend ugovor je `cfg-json-1`. U Angular-u se implementira adapter:
- `cfg-json-1 -> KnuthInputGraph`

Za finalno mapiranje potrebno je dostaviti jedan hardkodirani primer ulaza koji frontend trenutno koristi.

---