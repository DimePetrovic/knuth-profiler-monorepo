# Evaluacija Knutovog algoritma

Merenje nad velikim skupom nasumično generisanih grafova kontrole toka.
Nije test: property testovi (`*.property.spec.ts`) tvrde da je algoritam
**ispravan**, ova alatka meri koliko on **štedi**.

## Pokretanje

```
npx tsc -p tsconfig.tools.json
node .tools-out/tools/evaluacija/main.js > rezultati.json
```

Bez dodatnih zavisnosti — prevodi se `typescript`-om koji projekat već ima.
Traje oko minut za 10.000 grafova.

## Ponovljivost

Seme je fiksno (`SEME` u `main.ts`), pa dva pokretanja daju bajt-identičan
`rezultati.json`. Bez toga se nijedan broj iz rada ne bi mogao proveriti.

## Šta se meri

Po grafu: broj čvorova $n$, broj grana $e$, broj instrumentovanih grana
$|S|$, udeo $|S|/e$, i ušteda u broju operacija uvećavanja brojača u odnosu
na punu instrumentaciju svih grana.

Granične grane oko ulaza i izlaza se ne broje ni u $n$ ni u $e$ — tako ih
definiše i dokaz optimalnosti.

Zbir se daje **po klasi grafa i po veličini**, jer je jedan prosek preko
svega neupotrebljiv: linearan tok ne traži nijednu instrumentovanu granu, a
ugnježdena petlja traži skoro trećinu njih.

## Odnos prema testovima

Generator (`src/app/core/graph/random-graph.generator.ts`) i izvor
nasumičnosti (`prng.ts`) dele se sa property testovima. Alatka uvozi samo
čiste module aplikacije, bez Angular okruženja, pa se pokreće običnim
`node`-om.
