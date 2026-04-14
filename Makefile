.PHONY: fetch-metrics analytics analytics-push

fetch-metrics:
	gh workflow run fetch-metrics.yml
	@sleep 3
	gh run watch $$(gh run list --workflow=fetch-metrics.yml --limit=1 --json databaseId -q '.[0].databaseId') --exit-status

analytics:
	@export $$(cat analytics/.env | xargs) && export GITHUB_TOKEN=$$(gh auth token) && \
	  cd analytics && uv run scripts/fetch-metrics.py > /tmp/qrec-scalar.json && \
	  uv run scripts/fetch-github-sponsors.py > /tmp/qrec-sponsors.jsonl && \
	  python3 -c " \
	import json; \
	s = json.load(open('/tmp/qrec-scalar.json')); \
	[s['metrics'].update({m['name']: {'value': m['value'], 'status': m.get('status','ok'), 'fetched_at': s['fetched_at']}}) for m in [json.loads(l) for l in open('/tmp/qrec-sponsors.jsonl') if l.strip()]]; \
	print(json.dumps(s, indent=2)) \
	"

analytics-push:
	@export $$(cat analytics/.env | xargs) && export GITHUB_TOKEN=$$(gh auth token) && \
	  cd analytics && uv run scripts/fetch-metrics.py > /tmp/qrec-scalar.json && \
	  uv run scripts/fetch-github-sponsors.py > /tmp/qrec-sponsors.jsonl && \
	  python3 -c " \
	import json; \
	s = json.load(open('/tmp/qrec-scalar.json')); \
	[s['metrics'].update({m['name']: {'value': m['value'], 'status': m.get('status','ok'), 'fetched_at': s['fetched_at']}}) for m in [json.loads(l) for l in open('/tmp/qrec-sponsors.jsonl') if l.strip()]]; \
	open('/tmp/qrec-merged.json','w').write(json.dumps(s)) \
	" && \
	  uv run scripts/push-and-notify.py < /tmp/qrec-merged.json
