"""Validate real E2E success responses against the published OpenAPI contract."""
import json
import re
from pathlib import Path
import build_api_docs as contract

contract.finish_examples()
spec = contract.make_spec()
samples = json.loads((Path(__file__).resolve().parents[1] / '.tmp/commerce-contract-responses.json').read_text(encoding='utf-8'))
assert samples, 'Run the commerce E2E suite before checking response contracts'
checked = set()
for sample in samples:
    matches = [(path, methods[sample['method']]) for path, methods in spec['paths'].items()
               if sample['method'] in methods and re.fullmatch(re.sub(r'\{[^}]+\}', '[^/]+', path), sample['path'])]
    assert len(matches) == 1, f"Missing or ambiguous contract: {sample['method']} {sample['path']}"
    path, operation = matches[0]
    assert operation['x-implementation-status'] == 'implemented', path
    response = operation['responses'].get(str(sample['status']))
    assert response is not None, f"Undocumented status: {sample['status']} {path}"
    data_schema = response['content']['application/json']['schema']['properties']['data']
    contract.validate_value(sample['data'], data_schema, f"{sample['method']} {path}")
    checked.add((sample['method'], path))
print(json.dumps({'result': 'PASS', 'responses': len(samples), 'routes': len(checked)}))
