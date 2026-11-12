import json, collections, statistics as st
R=[json.loads(l) for l in open('results/rows.jsonl')]
ok=lambda r:r.get('tx') and r.get('status') and not r.get('submit_error') and not r.get('read_err')
last={}
for r in R:
    if ok(r): last[(r['set'],r['tag'],r['instance'])]=r
rows=list(last.values())
sm=lambda m:(m or '?').replace('policy:prd-','prd-')
tr=lambda r:'/'.join(r['result']) if r.get('result') else 'NONE('+str(r.get('status'))+')'
B2=[r for r in rows if r['set']=='B2']
cls=lambda r:r['case_id'].split('-')[2]
out={}
def cnt(rs): 
    c=collections.Counter(tr(r) for r in rs); return dict(c)
for k in ('on','off','border'):
    rs=[r for r in B2 if cls(r)==k]
    m=sum(1 for r in rs if r.get('result') and list(r['result'])==r['expected'])
    out[k]=dict(n=len(rs),match=m,dist=cnt(rs),und=sum(1 for r in rs if r['status']=='UNDETERMINED' or not r.get('result')),cnd=sum(1 for r in rs if r.get('result') and r['result'][0]=='could_not_decide'))
# per case
tab=[]
byc=collections.defaultdict(list)
for r in B2: byc[r['case_id']].append(r)
for c,rs in sorted(byc.items()):
    tab.append(dict(case=c,cls=cls(rs[0]),expected='/'.join(rs[0]['expected']),runs=[tr(r) for r in rs],match=sum(1 for r in rs if r.get('result') and list(r['result'])==r['expected']),stable=len({tr(r) for r in rs})==1,disagree=[r['vote_tally'].get('disagree',0) for r in rs],rot=[r['rotations'] for r in rs]))
out['table']=tab
pm=collections.defaultdict(lambda:[0,0,0])
for r in B2:
    if cls(r)=='border': continue
    k=sm(r['leader_model']); pm[k][1]+=1; pm[k][0]+=(r.get('result') and list(r['result'])==r['expected'])
    if r['status']=='UNDETERMINED' or not r.get('result'): pm[k][2]+=1
out['per_leader_clear']={k:v for k,v in sorted(pm.items(),key=lambda kv:-kv[1][1])}
out['overall_clear']=[out['on']['match']+out['off']['match'],out['on']['n']+out['off']['n']]
out['disagree_runs']=sum(1 for r in B2 if r['vote_tally'].get('disagree')); out['rot_runs']=sum(1 for r in B2 if (r['rotations'] or 0)>0)
out['timing']=dict(acc=round(st.median([r['accepted_ms'] for r in B2 if r['accepted_ms']])/1000,1),fin=round(st.median([r['final_ms'] for r in B2 if r['final_ms']])/1000,1)) if B2 else None
out['wrong_clear']=[(t['case'],t['runs'],t['expected']) for t in tab if t['cls']!='border' and t['match']<len(t['runs'])]
out['R4']=[dict(case=r['case_id'],tx=r['tx'],result=tr(r),expected='/'.join(r['expected']),acc=r['accepted_ms'],fin=r['final_ms'],rot=r['rotations'],leader=sm(r['leader_model']),agree=[sm(m) for m in r['agreeing_models']],path=r.get('result_path')) for r in rows if r['set']=='R4']
json.dump(out,open('results/analysis4.json','w'),indent=1)
print(json.dumps({k:out[k] for k in ('on','off','border','overall_clear','disagree_runs','rot_runs','timing','wrong_clear')},default=str))
print(len(B2),'B2 rows;',len(out['R4']),'R4 rows')
