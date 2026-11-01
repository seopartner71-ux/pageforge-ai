
- Internal link audit (/internal-link-audit): all calculation runs client-side in a Web Worker (src/lib/internalLinks/engine.ts, a 1:1 port of audit_links.py); only the summary and results JSON are stored in internal_link_audits, so heavy crawl data never loads the database.
