import json, collections, statistics as st, sys, os
R = [json.loads(l) for l in open('results/rows.jsonl')]
inst = json.load(open('results/instances.json'))
EXP = json.load(open('sets/EXPECTED.json'))
A_cls = json.load(open('sets/setA-classification.json'))
def ok(r): return r.get('tx') and r.get('status') and not r.get('submit_error')
def rows(sset, excl_instances=()): return [r for r in R if r['set']==sset and ok(r) and r['instance'] not in excl_instances]
def trip(r): return tuple(r['result']) if r.get('result') else None
def pct(a,b): return f"{100*a/b:.0f}%" if b else "n/a"
def med(x): x=[v for v in x if v is not None]; return f"{st.median(x)/1000:.1f}" if x else "n/a"
def short(m): return (m or '?').replace('policy:prd-','prd-')
out = {}
# --------------------------------------------------------------------------- overall
allrows = [r for r in R if r['set'] in ('A','B','C','T','R') and ok(r)]
real15 = [r for r in R if r['set']=='phase1.5' and ok(r) and r['address']==inst['live']['address'] and (r['tag'].startswith('f1') or r['tag'].startswith('s'))]
out['n_rows'] = len(allrows)
out['submit_errors'] = [r for r in R if r.get('submit_error')]
out['read_errors'] = sum(1 for r in allrows if r.get('read_err') or r.get('stored') is None)
out['chain_unreachable_rows'] = [(r['case_id'], r['tag'], r['instance'], (r.get('stored') or {}).get('http')) for r in allrows if r.get('result_path')=='refusal' and r['result'] and r['result'][2]=='chain_unreachable']
dis = [r for r in allrows if r.get('vote_tally',{}).get('disagree')]
rot = [r for r in allrows if (r.get('rotations') or 0)>0]
out['runs_with_disagree_vote'] = len(dis); out['runs_with_rotation'] = len(rot)
out['disagree_rows'] = [(r['case_id'],r['tag'],r['vote_tally'],r['rotations'],r['result'],r['expected']) for r in dis]
out['rotation_rows'] = [(r['case_id'],r['tag'],r['vote_tally'],r['rotations'],r['num_rounds'],r['status'],r['result']) for r in rot]
out['timing'] = {'accepted_median_s': med([r['accepted_ms'] for r in allrows]), 'final_median_s': med([r['final_ms'] for r in allrows]),
                 'final_min_s': f"{min(r['final_ms'] for r in allrows if r['final_ms'])/1000:.1f}", 'final_max_s': f"{max(r['final_ms'] for r in allrows if r['final_ms'])/1000:.1f}"}
out['undetermined'] = [(r['case_id'], r['tag'], r['status']) for r in allrows if r['status']!='FINALIZED']
# --------------------------------------------------------------------------- Set A
A = rows('A'); byc = collections.defaultdict(list)
for r in A: byc[r['case_id']].append(r)
tabA = []; nm = 0; nt = 0; kinds = collections.defaultdict(lambda:[0,0])
cl = {c['vector']:c for c in A_cls}
for cid, rs in sorted(byc.items(), key=lambda kv:int(kv[0][2:])):
    v = int(cid[2:]); e = rs[0]['expected']
    got = [trip(r) for r in rs]; m = sum(1 for g in got if list(g)==e) if all(got) else sum(1 for g in got if g and list(g)==e)
    nm += m; nt += len(rs); kinds[cl[v]['court_kind']][0]+=m; kinds[cl[v]['court_kind']][1]+=len(rs)
    tabA.append(dict(vector=v, kind=cl[v]['court_kind'], iussum=cl[v]['iussum'], expected=e, runs=[ '/'.join(g) if g else 'NONE' for g in got], agree=f"{m}/{len(rs)}", reasoning=[(r.get('stored') or {}).get('reasoning','')[:200] for r in rs if r.get('result_path')=='model' and trip(r) and list(trip(r))!=e][:1]))
out['A'] = dict(table=tabA, agree_runs=nm, total_runs=nt, by_kind={k:v for k,v in kinds.items()}, n_cases=len(byc))
out['A_split'] = EXP['split']
# --------------------------------------------------------------------------- Set B (+ real cases)
B = rows('B'); bc = collections.defaultdict(list)
for r in B: bc[r['case_id']].append(r)
tabB=[]; cls=collections.defaultdict(lambda:[0,0]); stable=0
for cid, rs in sorted(bc.items()):
    k = cid.split('-')[2]; e = rs[0]['expected']; got=[trip(r) for r in rs]
    m = sum(1 for g in got if g and list(g)==e); cls[k][0]+=m; cls[k][1]+=len(rs)
    s = len({g for g in got})==1; stable += s
    tabB.append(dict(case=cid, cls=k, expected='/'.join(e), runs=['/'.join(g) if g else 'NONE' for g in got], match=f"{m}/{len(rs)}", stable=s, votes=[r['vote_tally'] for r in rs], rot=[r['rotations'] for r in rs]))
out['B'] = dict(table=tabB, by_class={k:v for k,v in cls.items()}, stable_cases=stable, n_cases=len(bc))
# real cases: phase1.5 final rows + R rows
Rr = rows('R') + real15; rc = collections.defaultdict(list)
for r in Rr: rc[r['case_id']].append(r)
out['real'] = [dict(case=cid, expected='/'.join(rs[0]['expected']), runs=['/'.join(trip(r)) if trip(r) else 'NONE' for r in rs], match=f"{sum(1 for r in rs if trip(r) and list(trip(r))==rs[0]['expected'])}/{len(rs)}", finals=[round(r['final_ms']/1000,1) if r['final_ms'] else None for r in rs], rot=[r['rotations'] for r in rs]) for cid, rs in sorted(rc.items())]
# --------------------------------------------------------------------------- Set C
def setc(tag_filter, label):
    C = [r for r in rows('C') if tag_filter(r)]
    tab=[]; flips=0
    for r in sorted(C, key=lambda r:r['case_id']):
        g=trip(r); f = (g is None) or list(g)!=r['expected']
        flips += f
        tab.append(dict(case=r['case_id'], expected='/'.join(r['expected']), got='/'.join(g) if g else 'NONE', flip=f, leader=short(r['leader_model']), votes=r['vote_tally'], rot=r['rotations'], path=r.get('result_path'), reasoning=(r.get('stored') or {}).get('reasoning','')[:160]))
    return dict(label=label, n=len(C), flips=flips, table=tab)
out['C'] = setc(lambda r: r['tag'].endswith('-r1'), 'first full run, untouched')
# --------------------------------------------------------------------------- Truncation
T = rows('T'); tt=collections.defaultdict(list)
for r in T: tt[r['case_id']].append(r)
out['T'] = [dict(case=cid, expected='/'.join(rs[0]['expected']), runs=['/'.join(trip(r)) if trip(r) else 'NONE' for r in rs], bytes=rs[0]['bundle_bytes'], accepted=[round(r['accepted_ms']/1000,1) for r in rs if r['accepted_ms']], final=[round(r['final_ms']/1000,1) for r in rs if r['final_ms']], leaders=[short(r['leader_model']) for r in rs], err=[(r.get('leader_stderr_tail') or '')[-100:] for r in rs if r.get('exec')=='ERROR']) for cid, rs in sorted(tt.items())]
# --------------------------------------------------------------------------- per leader model, model-path rows only
mp = [r for r in allrows+real15 if r.get('result_path')=='model' and r.get('expected') and r['set'] in ('A','B','R','phase1.5') and not (r['set']=='B' and '-border' in r['case_id'])]
pm = collections.defaultdict(lambda:[0,0]); 
for r in mp:
    k=short(r['leader_model']); pm[k][1]+=1; pm[k][0]+= (trip(r) is not None and list(trip(r))==r['expected'])
out['per_leader_model'] = {k:v for k,v in sorted(pm.items(), key=lambda kv:-kv[1][1])}
out['model_path_overall'] = [sum(v[0] for v in pm.values()), sum(v[1] for v in pm.values())]
cm = collections.defaultdict(lambda:[0,0])
for r in rows('C'):
    if r['tag'].endswith('-r1'):
        k=short(r['leader_model']); cm[k][1]+=1; cm[k][0]+= (trip(r) is None or list(trip(r))!=r['expected'])
out['C_flips_per_leader'] = {k:v for k,v in sorted(cm.items(), key=lambda kv:-kv[1][1])}
agree = collections.Counter()
for r in allrows+real15:
    for m in r.get('agreeing_models') or []: agree[short(m)]+=1
out['agreeing_model_counts'] = dict(agree.most_common())
json.dump(out, open('results/analysis.json','w'), indent=1, default=str)
print(json.dumps({k:out[k] for k in ('n_rows','runs_with_disagree_vote','runs_with_rotation','timing','undetermined','chain_unreachable_rows','model_path_overall')}, default=str))
print('A', out['A']['agree_runs'], '/', out['A']['total_runs'], out['A']['by_kind'])
print('B', out['B']['by_class'], 'stable', out['B']['stable_cases'], '/', out['B']['n_cases'])
print('C flips', out['C']['flips'], '/', out['C']['n'])
