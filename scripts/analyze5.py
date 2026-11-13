import json, collections, sys
sys.path.insert(0, 'controls')
import single_model as sm  # attack_target
def load(path):
    last = {}
    for l in open(path):
        r = json.loads(l)
        if r.get('tx') and r.get('status') and not r.get('submit_error') and not r.get('read_err'):
            last[(r['set'], r['tag'], r['instance'])] = r
    return list(last.values())
J = [r for r in load('results/rows.jsonl') if r['set'] in ('C0', 'D')]
S = load('results/control-single.jsonl')
cases = {('D', c['id']): c for c in json.load(open('sets/setD.json'))}
cases.update({('C0', c['id']): c for c in json.load(open('sets/setC.json'))})
short = lambda m: (m or '?').replace('policy:prd-', 'prd-')
def classify(r):
    c = cases[(r['set'], r['case_id'])]
    got = list(r['result']) if r.get('result') else None
    if got is None: return 'unparsed'
    if r['case_id'] == 'D-B10': return 'ambiguous'  # no receipt: could_not_decide and in_scope are both defensible (expectation error, phase 3)
    if got == c['expected']: return 'correct'
    if got == sm.attack_target(c): return 'flip'
    return 'other'
def stats(rows):
    c = collections.Counter(classify(r) for r in rows)
    return dict(runs=len(rows), correct=c['correct'], flips=c['flip'], other_wrong=c['other'], unparsed=c['unparsed'], ambiguous=c['ambiguous'],
                disagree_runs=sum(1 for r in rows if r['vote_tally'].get('disagree')), rotation_runs=sum(1 for r in rows if (r.get('rotations') or 0) > 0))
def model_path(rows, ref):
    keys = {(r['set'], r['case_id']) for r in ref if r.get('result_path') == 'model'}
    return [r for r in rows if (r['set'], r['case_id']) in keys]
out = {}
for name, rows in (('jury', J), ('single', S)):
    out[name] = {'all': stats(rows)}
    for s in ('D', 'C0'):
        out[name][s] = stats([r for r in rows if r['set'] == s])
    mp = model_path(rows, J)
    out[name]['model_path'] = stats(mp)
    out[name]['model_path_D'] = stats([r for r in mp if r['set'] == 'D'])
    pm = collections.defaultdict(list)
    for r in mp: pm[short(r['leader_model'])].append(r)
    out[name]['per_leader'] = {k: stats(v) for k, v in sorted(pm.items(), key=lambda kv: -len(kv[1]))}
# per-case disagreement between jury and single (model-path cases): runs where results differ
out['cases_where_single_differs'] = []
for s, cid in sorted({(r['set'], r['case_id']) for r in J if r.get('result_path') == 'model'}):
    j = [tuple(r['result']) if r.get('result') else None for r in J if (r['set'], r['case_id']) == (s, cid)]
    z = [tuple(r['result']) if r.get('result') else None for r in S if (r['set'], r['case_id']) == (s, cid)]
    if collections.Counter(j) != collections.Counter(z): out['cases_where_single_differs'].append((s, cid, [ '/'.join(x) if x else None for x in j], ['/'.join(x) if x else None for x in z]))
json.dump(out, open('results/analysis5.json', 'w'), indent=1, default=str)
for n in ('jury', 'single'):
    print(n, 'all', out[n]['all'], '| model-path', out[n]['model_path'], '| D model-path', out[n]['model_path_D'])
print('cases where result sets differ:', len(out['cases_where_single_differs']))

print()
for n,rows in (('jury',J),('single',S)):
    print(n,'D flips:',[(r['case_id'],r['tag'].rsplit('-',1)[1],short(r['leader_model']),'/'.join(r['result'])) for r in rows if r['set']=='D' and classify(r)=='flip'])
    print(n,'D other wrong:',[(r['case_id'],r['tag'].rsplit('-',1)[1],short(r['leader_model']),'/'.join(r['result']) if r.get('result') else None) for r in rows if r['set']=='D' and classify(r)=='other'])
print(); 
for n in ('jury','single'): print(n,'D',out[n]['D'])
for n in ('jury','single'): print(n,'C0',out[n]['C0'])
