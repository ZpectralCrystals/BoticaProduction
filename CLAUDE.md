## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
## response style

Rules:
- NO introductory/transitional phrases ("Claro", "Aquí está", "Para responder")
- NO explanations of what you're about to do
- NO polite closings ("Espero que sirva", "¿Necesitas algo más?")
- Output format: code > bullet points > short sentences
- Never ask clarifying questions unless absolutely necessary
- Never explain code structure unless asked