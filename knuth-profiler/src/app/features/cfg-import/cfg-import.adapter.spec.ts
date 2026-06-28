import { mapCfgJsonToGraphData } from './cfg-import.adapter';

describe('cfg-import.adapter', () => {
  it('should prefer actual ENTRY/EXIT nodes over mismatched entryNodeId/exitNodeId metadata', () => {
    const result = mapCfgJsonToGraphData({
      version: 'cfg-json-1',
      language: 'c',
      filename: 'main.c',
      sourceHash: 'sha256:x',
      graph: {
        // Deliberately incorrect metadata to reproduce user-reported issue.
        entryNodeId: 'n1',
        exitNodeId: 'n1',
        nodes: [
          { id: 'n0', kind: 'entry', label: 'ENTRY', range: null },
          { id: 'n1', kind: 'stmt', label: 'x=1', range: null },
          { id: 'n2', kind: 'exit', label: 'EXIT', range: null },
        ],
        edges: [
          { from: 'n0', to: 'n1', kind: 'next', label: '' },
          { from: 'n1', to: 'n2', kind: 'next', label: '' },
        ],
      },
    });

    const entrySentinel = result.edges.find(e => e.id === '__entry_sentinel__');
    const exitSentinel = result.edges.find(e => e.id === '__exit_sentinel__');

    expect(entrySentinel?.target).toBe('ENTRY');
    expect(exitSentinel?.source).toBe('EXIT');
    expect(result.nodes.filter(n => n.kind === 'entry').length).toBe(1);
    expect(result.nodes.filter(n => n.kind === 'exit').length).toBe(1);

    // Main flow must remain ENTRY -> stmt -> EXIT
    expect(result.edges.some(e => e.source === 'ENTRY' && e.target === 'n1')).toBeTrue();
    expect(result.edges.some(e => e.source === 'n1' && e.target === 'EXIT')).toBeTrue();
  });

  it('should map METHOD_RETURN to canonical EXIT when multiple RETURN-like nodes exist', () => {
    const result = mapCfgJsonToGraphData({
      version: 'cfg-json-1',
      language: 'c',
      filename: 'main.c',
      sourceHash: 'sha256:y',
      graph: {
        entryNodeId: 'n10',
        exitNodeId: 'n20',
        nodes: [
          { id: 'n10', kind: 'entry', label: 'METHOD, 2 main', range: null },
          { id: 'n31', kind: 'exit', label: 'RETURN, 27 return 1;', range: null },
          { id: 'n32', kind: 'exit', label: 'RETURN, 32 return 1;', range: null },
          { id: 'n99', kind: 'exit', label: 'METHOD_RETURN, 3 int', range: null },
        ],
        edges: [
          { from: 'n10', to: 'n31', kind: 'next', label: '' },
          { from: 'n31', to: 'n99', kind: 'next', label: '' },
          { from: 'n32', to: 'n99', kind: 'next', label: '' },
        ],
      },
    });

    const exitNode = result.nodes.find(n => n.id === 'EXIT');
    expect(exitNode?.label).toBe('EXIT');
    expect(result.nodes.filter(n => n.kind === 'exit').length).toBe(1);
    expect(result.edges.some(e => e.source === 'n31' && e.target === 'EXIT')).toBeTrue();
    expect(result.edges.some(e => e.source === 'n32' && e.target === 'EXIT')).toBeTrue();
  });

  it('should trim verbose Joern prefixes before comma in node labels', () => {
    const result = mapCfgJsonToGraphData({
      version: 'cfg-json-1',
      language: 'c',
      filename: 'main.c',
      sourceHash: 'sha256:z',
      graph: {
        entryNodeId: 'm',
        exitNodeId: 'mr',
        nodes: [
          { id: 'm', kind: 'entry', label: 'METHOD, 2 main', range: null },
          { id: 'n1', kind: 'stmt', label: 'RETURN, 36 return 0;', range: null },
          { id: 'mr', kind: 'exit', label: 'METHOD_RETURN, 3 int', range: null },
        ],
        edges: [
          { from: 'm', to: 'n1', kind: 'next', label: '' },
          { from: 'n1', to: 'mr', kind: 'next', label: '' },
        ],
      },
    });

    const n1 = result.nodes.find(n => n.id === 'n1');
    expect(n1?.label).toBe('36 return 0;');
    expect(result.edges.some(e => e.id === 'e0')).toBeTrue();
  });

  it('should keep only the content after first comma in imported labels', () => {
    const result = mapCfgJsonToGraphData({
      version: 'cfg-json-1',
      language: 'c',
      filename: 'main.c',
      sourceHash: 'sha256:a1',
      graph: {
        entryNodeId: 'm',
        exitNodeId: 'mr',
        nodes: [
          { id: 'm', kind: 'entry', label: 'METHOD, 2 main', range: null },
          { id: 'add', kind: 'stmt', label: 'addition, 14 a + b', range: null },
          { id: 'mr', kind: 'exit', label: 'METHOD_RETURN, 3 int', range: null },
        ],
        edges: [
          { from: 'm', to: 'add', kind: 'next', label: '' },
          { from: 'add', to: 'mr', kind: 'next', label: '' },
        ],
      },
    });

    const add = result.nodes.find(n => n.id === 'add');
    expect(add?.label).toBe('14 a + b');
  });
});

describe('cfg-import.adapter – extra coverage', () => {
  it('assigns deterministic Ball-Larus style weights to imported normal edges', () => {
    const result = mapCfgJsonToGraphData({
      version: 'cfg-json-1',
      language: 'c',
      filename: 'main.c',
      sourceHash: 'sha256:bl',
      graph: {
        entryNodeId: 'm',
        exitNodeId: 'x',
        nodes: [
          { id: 'm', kind: 'entry', label: 'ENTRY', range: null },
          { id: 'a', kind: 'stmt', label: 'A', range: null },
          { id: 'b', kind: 'stmt', label: 'B', range: null },
          { id: 'x', kind: 'exit', label: 'EXIT', range: null },
        ],
        edges: [
          { from: 'm', to: 'a', kind: 'next', label: '' },
          { from: 'm', to: 'b', kind: 'next', label: '' },
          { from: 'a', to: 'x', kind: 'next', label: '' },
          { from: 'b', to: 'x', kind: 'next', label: '' },
        ],
      },
    });

    const normalEdges = result.edges
      .filter(edge => edge.kind === 'normal')
      .map(edge => ({ id: edge.id, weight: edge.weight }));

    expect(normalEdges).toEqual([
      { id: 'e0', weight: 1 },
      { id: 'e1', weight: 2 },
      { id: 'e2', weight: 1 },
      { id: 'e3', weight: 1 },
    ]);
  });

  it('preserves range metadata in node data', () => {
    const result = mapCfgJsonToGraphData({
      version: 'cfg-json-1',
      language: 'c',
      filename: 'main.c',
      sourceHash: 'sha256:r1',
      graph: {
        entryNodeId: 'm',
        exitNodeId: 'mr',
        nodes: [
          { id: 'm', kind: 'entry', label: 'METHOD, 2 main', range: null },
          { id: 'n1', kind: 'stmt', label: 'ASSIGN, 5 x = 1', range: 5 },
          { id: 'mr', kind: 'exit', label: 'METHOD_RETURN, 3 int', range: null },
        ],
        edges: [
          { from: 'm', to: 'n1', kind: 'next', label: '' },
          { from: 'n1', to: 'mr', kind: 'next', label: '' },
        ],
      },
    });

    const n1 = result.nodes.find(n => n.id === 'n1');
    expect(n1?.data?.['range']).toBe(5);
  });

  it('keeps label as-is when there is no comma in node label', () => {
    const result = mapCfgJsonToGraphData({
      version: 'cfg-json-1',
      language: 'c',
      filename: 'main.c',
      sourceHash: 'sha256:r2',
      graph: {
        entryNodeId: 'e',
        exitNodeId: 'x',
        nodes: [
          { id: 'e', kind: 'entry', label: 'ENTRY', range: null },
          { id: 'plain', kind: 'stmt', label: 'x++', range: null },
          { id: 'x', kind: 'exit', label: 'EXIT', range: null },
        ],
        edges: [
          { from: 'e', to: 'plain', kind: 'next', label: '' },
          { from: 'plain', to: 'x', kind: 'next', label: '' },
        ],
      },
    });

    const node = result.nodes.find(n => n.id === 'plain');
    expect(node?.label).toBe('x++');
  });

  it('resolves entry from METHOD label when entryNodeId does not match any kind=entry node', () => {
    const result = mapCfgJsonToGraphData({
      version: 'cfg-json-1',
      language: 'c',
      filename: 'main.c',
      sourceHash: 'sha256:r3',
      graph: {
        entryNodeId: 'n99',
        exitNodeId: 'n98',
        nodes: [
          { id: 'n1', kind: 'stmt', label: 'METHOD, 1 main', range: null },
          { id: 'n2', kind: 'stmt', label: 'x = 1', range: null },
          { id: 'n98', kind: 'stmt', label: 'METHOD_RETURN, 3 int', range: null },
        ],
        edges: [
          { from: 'n1', to: 'n2', kind: 'next', label: '' },
          { from: 'n2', to: 'n98', kind: 'next', label: '' },
        ],
      },
    });

    // n1 (METHOD) should be resolved as ENTRY
    expect(result.nodes.some(n => n.id === 'ENTRY')).toBeTrue();
  });

  it('adds sentinel edges automatically if missing from input', () => {
    const result = mapCfgJsonToGraphData({
      version: 'cfg-json-1',
      language: 'c',
      filename: 'main.c',
      sourceHash: 'sha256:r4',
      graph: {
        entryNodeId: 'a',
        exitNodeId: 'b',
        nodes: [
          { id: 'a', kind: 'entry', label: 'ENTRY', range: null },
          { id: 'b', kind: 'exit', label: 'EXIT', range: null },
        ],
        edges: [{ from: 'a', to: 'b', kind: 'next', label: '' }],
      },
    });

    const hasEntrySentinel = result.edges.some(e => e.id === '__entry_sentinel__');
    const hasExitSentinel = result.edges.some(e => e.id === '__exit_sentinel__');
    expect(hasEntrySentinel).toBeTrue();
    expect(hasExitSentinel).toBeTrue();
  });
});
