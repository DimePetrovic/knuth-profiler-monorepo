/**
 * Odgovor servera za funkciju `sign` iz listinga u radu, dobijen STVARNIM
 * alatom Joern (v4.0.515, kroz docker compose iz knuth-backend), a ne mock
 * rezimom. Snimljeno 19.08.2026.
 *
 * Sluzi da red „Увезени код" iz tabele sazetka u radu ($n = 8$, $e = 9$,
 * $|S| = 2$) bude proveren i bez pokrenutog Joern-a. Ako se verzija Joern-a
 * promeni, ovaj uzorak zastareva — tada ga treba snimiti ponovo, a ne
 * prilagoditi ocekivanja testu.
 *
 * Vidi `prenos/slike-faza-3/uvoz.mjs` u repou rada za nacin snimanja.
 */
import { CfgResultJson } from '../cfg-import.types';

export const SIGN_JOERN_RESULT: CfgResultJson = {
  "version": "cfg-json-1",
  "language": "c",
  "filename": "sign.c",
  "sourceHash": "sha256:c2774dff467a157fc476daf7bb63bd0505dac7196cc5916b97b1570f18490eb2",
  "graph": {
    "entryNodeId": "107374182400",
    "exitNodeId": "124554051584",
    "nodes": [
      {
        "id": "30064771072",
        "kind": "stmt",
        "label": ".equals, 2 x == 0",
        "range": null
      },
      {
        "id": "141733920768",
        "kind": "return",
        "label": "RETURN, 3 return 0;",
        "range": null
      },
      {
        "id": "30064771073",
        "kind": "stmt",
        "label": ".greaterThan, 4 x > 0",
        "range": null
      },
      {
        "id": "141733920769",
        "kind": "return",
        "label": "RETURN, 5 return 1;",
        "range": null
      },
      {
        "id": "141733920770",
        "kind": "return",
        "label": "RETURN, 7 return -1;",
        "range": null
      },
      {
        "id": "30064771074",
        "kind": "stmt",
        "label": ".minus, 7 -1",
        "range": null
      },
      {
        "id": "107374182400",
        "kind": "entry",
        "label": "METHOD, 1 sign",
        "range": null
      },
      {
        "id": "124554051584",
        "kind": "exit",
        "label": "METHOD_RETURN, 1 int",
        "range": null
      }
    ],
    "edges": [
      {
        "from": "30064771072",
        "to": "141733920768",
        "kind": "next",
        "label": ""
      },
      {
        "from": "30064771072",
        "to": "30064771073",
        "kind": "next",
        "label": ""
      },
      {
        "from": "141733920768",
        "to": "124554051584",
        "kind": "next",
        "label": ""
      },
      {
        "from": "30064771073",
        "to": "141733920769",
        "kind": "next",
        "label": ""
      },
      {
        "from": "30064771073",
        "to": "30064771074",
        "kind": "next",
        "label": ""
      },
      {
        "from": "141733920769",
        "to": "124554051584",
        "kind": "next",
        "label": ""
      },
      {
        "from": "141733920770",
        "to": "124554051584",
        "kind": "next",
        "label": ""
      },
      {
        "from": "30064771074",
        "to": "141733920770",
        "kind": "next",
        "label": ""
      },
      {
        "from": "107374182400",
        "to": "30064771072",
        "kind": "next",
        "label": ""
      }
    ]
  }
};
