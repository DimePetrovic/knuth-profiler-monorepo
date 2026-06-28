import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import elk from 'cytoscape-elk';

let pluginsRegistered = false;

export function ensureCytoscapePluginsRegistered(): void {
  if (pluginsRegistered) {
    return;
  }

  cytoscape.use(dagre);
  cytoscape.use(elk);
  pluginsRegistered = true;
}