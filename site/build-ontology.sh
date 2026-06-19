#!/bin/sh
# Regenerate ontology.svg from ontology.dot with theme-aware styling.
# CSS rules override graphviz's baked presentation attributes (which have
# zero specificity), and the @media block makes the diagram follow the
# viewer's light/dark preference even when the SVG is used via <img>.
set -e
cd "$(dirname "$0")"
dot -Tsvg ontology.dot -o ontology.svg.tmp
python3 - <<'PY'
style = '''<style>
.node polygon,.node path,.node ellipse{fill:#f4f4f2;stroke:#cfcfc9}
.node text{fill:#1a1a1a}
.edge path{stroke:#9a9a94}
.edge polygon{fill:#9a9a94;stroke:#9a9a94}
.edge text{fill:#6b6b66}
/* role colours (must follow .node so they win on equal specificity) */
.assert polygon{fill:#e8effd;stroke:#aac3f5}
.primary polygon{fill:#edeff2;stroke:#cfcfc9}
.rule polygon{fill:#f7f1e6;stroke:#d8c9ad}
.cond polygon{fill:#f3eef8;stroke:#cdbfe0}
.abstract polygon{stroke-dasharray:5 3}
.hub polygon,.hub path,.hub ellipse{fill:#e8effd;stroke:#1a56db}
@media (prefers-color-scheme:dark){
 .node polygon,.node path,.node ellipse{fill:#1c1c1c;stroke:#3a3a3a}
 .node text{fill:#d7d7d2}
 .edge path{stroke:#6b6b66}
 .edge polygon{fill:#6b6b66;stroke:#6b6b66}
 .edge text{fill:#9a9a84}
 .assert polygon{fill:#16223a;stroke:#3d5a8a}
 .primary polygon{fill:#23262b;stroke:#3a3a3a}
 .rule polygon{fill:#2a2418;stroke:#5a4d33}
 .cond polygon{fill:#251f2e;stroke:#4d3f5e}
 .hub polygon,.hub path,.hub ellipse{fill:#16223a;stroke:#8ab4f8}
}
</style>'''
s = open('ontology.svg.tmp').read()
i = s.index('>', s.index('<svg')) + 1
open('ontology.svg', 'w').write(s[:i] + style + s[i:])
PY
rm ontology.svg.tmp
echo "wrote ontology.svg"
