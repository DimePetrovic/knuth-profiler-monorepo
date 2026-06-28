# Ball-Larus Warning

Datum: 2026-04-02
Scope: Knuth Profiler frontend CFG weighting logic

## Svrha

Ovaj dokument precizira gde se trenutna implementacija poklapa sa Ball-Larus pristupom, a gde namerno odstupa od kanonskog Ball-Larus path profiling algoritma.

Zakljucak u jednoj recenici:
Trenutna logika je Ball-Larus style numeracija tezina na granama za potrebe vizuelizacije/MST/instrumentacije, ali nije kompletna kanonska Ball-Larus implementacija sa path registrima i formalnom transformacijom petlji.

## Sta je uskladjeno sa Ball-Larus idejom

- Tezine se dodeljuju deterministicki po izlaznim granama cvora.
- Koristi se DAG pogled (nakon izdvajanja back-edge grana) da bi se izracunao broj putanja do EXIT.
- Dodela tezina prati prefiksni sabirni princip: tezina grane zavisi od zbira broja putanja prethodnih sibling grana.
- Ovo obezbedjuje stabilno i ponovljivo obelezavanje grana za isti ulazni graf.

Relevantna implementacija:
- src/app/features/cfg-import/cfg-import.adapter.ts, funkcije:
  - assignBallLarusWeights
  - detectBackEdgeIds
  - buildTopologicalOrder
  - computePathCounts

## Precizna odstupanja od kanonskog Ball-Larus algoritma

1. 1-based offset umesto 0-based offset

- U kanonskom Ball-Larus-u za DAG numeraciju tipicno se koristi offset od 0 pri prolasku kroz izlazne grane cvora.
- Kod nas offset krece od 1.
- Posledica: svi path ID i edge kontribucije su translirane u odnosu na kanonsku 0-based semantiku.

Mesto u kodu:
- src/app/features/cfg-import/cfg-import.adapter.ts
  - let offset = 1

2. Obrada petlji je pojednostavljena

- Kanonski Ball-Larus za CFG sa petljama uvodi transformacije grafa (npr. secenje/back-edge tretman uz odgovarajuce reset/update pravilo za path registar izmedju iteracija).
- Kod nas se back-edge grane detektuju DFS-om i njihova tezina se postavlja na 1, bez pune BL semantike za reset akumulatora path ID-a po iteraciji.
- Posledica: tezine ostaju korisne za demonstraciju i heuristiku, ali nisu dovoljne da same po sebi garantuju kanonsko jedinstveno kodiranje dinamickih putanja kroz petlje.

Mesto u kodu:
- src/app/features/cfg-import/cfg-import.adapter.ts
  - detectBackEdgeIds
  - if (backEdgeIds.has(edge.id)) { edge.weight = 1; }

3. Nema eksplicitnog Ball-Larus path registra

- Kanonski Ball-Larus profilisanje koristi path register (ili ekvivalent) koji se azurira po tranziciji i emituje pri odredjenim tackama (npr. na ulasku/izlasku iz regiona putanje).
- U ovoj aplikaciji takav mehanizam ne postoji kao runtime profiling komponenta.
- Posledica: sistem nije path-profiling instrument u kanonskom smislu, vec edukativno-analiticki tok gde su tezine ulaz za MST i selektivnu instrumentaciju grana.

Mesta gde se tezine dalje koriste:
- src/app/core/graph/graph-analysis.ts (MST + instrumented edge selection)
- src/app/features/examples/simulation.engine.ts (weighted izbor naredne grane u simulaciji)

4. Semantika tezina je prilagodjena cilju aplikacije

- U kanonskom Ball-Larus-u tezine i event instrumentacija sluze rekonstrukciji putanja programa.
- Ovde tezine sluze pre svega:
  - vizuelnom isticanju strukturnog znacaja,
  - odabiru grana van MST za merenje,
  - edukativnoj rekonstrukciji kroz flow-balance korake.
- Posledica: treba ih tumaciti kao BL-inspired signal, ne kao direktan ekvivalent originalnog BL path ID sistema.

## Prakticni efekat na validnost rezultata

- Za aciklicne delove grafa, ponasanje je blisko BL intuiciji.
- Za ciklicne grafove, rezultat je stabilna i korisna aproksimacija, ali ne i formalna BL garancija jedinstvenog kodiranja svih dinamickih putanja.
- Za cilj proizvoda (vizualizacija, MST, selektivna instrumentacija i edukativna rekonstrukcija) trenutni pristup je funkcionalan i konzistentan.

## Test pokrivenost danas

Postoji test koji eksplicitno proverava deterministic Ball-Larus style tezine na importovanom grafu:
- src/app/features/cfg-import/cfg-import.adapter.spec.ts
  - test: assigns deterministic Ball-Larus style weights to imported normal edges

Napomena:
- Test naziv je namerno Ball-Larus style, sto je tacno i odgovara stvarnom dometu implementacije.

## Preporuka za komunikaciju u UI/dokumentaciji

Da ne bi bilo pogresnog tumacenja, preporuka je da svuda gde pise Ball-Larus stoji:
- Ball-Larus style edge weighting
ili
- Ball-Larus inspired weighting

umesto formulacije koja implicira punu, kanonsku BL path-profiling implementaciju.

## Ako zelimo strict Ball-Larus u sledecoj iteraciji

Minimum promena:

- Uvesti 0-based offset u DAG numeraciji.
- Formalizovati transformaciju ciklusa prema BL modelu (jasna pravila za back-edge i reset/update path registra).
- Uvesti eksplicitan path register i emitovanje path ID dogadjaja.
- Dodati testove koji verifikuju:
  - jedinstvenost path ID po aciklicnoj putanji,
  - korektnost kroz vise iteracija petlje,
  - konzistentnost rekonstrukcije iz instrumentisanih dogadjaja.
