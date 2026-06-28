# TODO do javno dostupne app

Brzi plan za nastavak, bez birokratije.

## 1) Stabilizacija pre deploy-a

- [ ] Proći ceo flow ručno za `Примери` i `CFG` (od koraka 1 do `Заврши`)
- [ ] Proveriti edge-case: mali broj prolaza, nule na instrumentisanim granama
- [ ] Dodati još 2-3 regression testa za wizard navigaciju (posebno reset i finish)
- [ ] Ugasiti sve preostale UI bagove (spacing, mobile, overflow)

## 2) Frontend production spreman

- [ ] U `cfg-import.api.service.ts` prebaciti API base na `/api`
- [ ] Proveriti da `npm run build` prolazi bez warninga koji nas blokiraju
- [ ] Napraviti mini smoke checklist za release (home, primeri, cfg import, rekonstrukcija)

## 3) Backend production spreman

- [ ] Potvrditi da `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d` radi na čistom serveru
- [ ] Proveriti health svih servisa (`redis`, `warm_joern`, `api`, `worker`)
- [ ] Istestirati jedan real upload i jedan source submit kroz API
- [ ] Proveriti timeoute i memory usage za veće fajlove

## 4) Domena + HTTPS

- [ ] DNS: `A @` i `A www` na IP servera
- [ ] Nginx: frontend na `/`, API proxy na `/api/`
- [ ] Certbot: TLS za domen + redirect na HTTPS
- [ ] Potvrditi auto-renew sertifikata (`certbot renew --dry-run`)

## 5) Objavljivanje

- [ ] Frontend build kopirati na `/var/www/knuth-profiler`
- [ ] Backend podići preko systemd servisa
- [ ] Napraviti prvi “public sanity run” sa spoljne mreže
- [ ] Podesiti monitoring logova (bar osnovno)

## 6) Posle puštanja

- [ ] Dodati kratku stranicu "Known limitations" (šta app trenutno ne podržava)
- [ ] Uvesti basic rate limit na Nginx za API
- [ ] Dodati backup/restore plan za server konfiguraciju
- [ ] Dogovoriti cadence za održavanje i update dependency-ja

---

## Minimalni cilj (MVP release)

Ako hoćemo brzo online:

1. API base `/api`
2. Docker backend u `prod` modu
3. Nginx + domen + HTTPS
4. Jedan full manual test `CFG` + jedan `Примери`
5. Objavi
