import json, collections
R=[json.loads(l) for l in open('results/rows.jsonl')]
ok=lambda r:r.get('tx') and r.get('status') and not r.get('submit_error') and not r.get('read_err')
_last={}
for r in R:
    if ok(r): _last[(r['set'],r['tag'],r['instance'])]=r
R=list(_last.values())
sm=lambda m:(m or '?').replace('policy:prd-','prd-')
tr=lambda r:'/'.join(r['result']) if r.get('result') else 'NONE('+str(r.get('status'))+')'
out={}
def block(sset):
    rows=[r for r in R if r['set']==sset and ok(r)]
    byc=collections.defaultdict(list)
    for r in rows: byc[r['case_id']].append(r)
    tab=[]; flips=und=wrong=0
    for cid,rs in sorted(byc.items()):
        e=rs[0]['expected']; got=[]
        for r in rs:
            g=list(r['result']) if r.get('result') else None
            if g is None: und+=1; kind='UND'
            elif g!=e: flips+=1; kind='FLIP'
            else: kind='ok'
            got.append((kind,tr(r),sm(r['leader_model']),r.get('rotations'),r.get('vote_tally')))
        tab.append(dict(case=cid,expected='/'.join(e),runs=got,note=(rs[0].get('note') or '')))
    return dict(n_runs=len(rows),n_cases=len(byc),flips=flips,undetermined=und,table=tab)
out['C0']=block('C0'); out['D']=block('D')
# per leader
for k in ('C0','D'):
    pm=collections.defaultdict(lambda:[0,0])
    for r in [r for r in R if r['set']==k and ok(r)]:
        g=list(r['result']) if r.get('result') else None
        pm[sm(r['leader_model'])][1]+=1; pm[sm(r['leader_model'])][0]+= (g is None or g!=r['expected'])
    out[k]['bad_per_leader']={a:b for a,b in sorted(pm.items(),key=lambda kv:-kv[1][1])}
json.dump(out,open('results/analysis3.json','w'),indent=1)
for k in ('C0','D'):
    o=out[k]; print(k,'runs',o['n_runs'],'cases',o['n_cases'],'flips',o['flips'],'undetermined',o['undetermined'])
    for t in o['table']:
        bad=[x for x in t['runs'] if x[0]!='ok']
        if bad: print('  ',t['case'],t['expected'],[(x[0],x[1],x[2],x[3]) for x in bad])
