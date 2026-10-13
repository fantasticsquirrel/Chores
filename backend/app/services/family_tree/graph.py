"""Bounded, typed, deterministic graph reads; no named/genetic kinship claims.

Continuation is append-only at the same revision/filter: clients union node/edge
IDs, retaining earlier pages. Signed tokens confer no access and expire when
revision changes. Loading is limited to 5,000 people / 20,000 facts; outputs to
500 nodes / 1,000 edges. Traversal is visited-set bounded even on corrupt data.
"""
import base64
from collections import deque
import hashlib
import hmac
import json
from sqlalchemy import select
from app.config import get_settings
from app.models.family_tree import FamilyTreePerson,FamilyTreeParentLink,FamilyTreeCareLink,FamilyTreePartnerEpisode
from .access import authorize,collection,person,error
from .observability import emit, warning_events


def load(session,actor,history=True):
    authorize(session,actor)
    # Project small JSON facts in SQL: never materialize 5,000 note bodies or
    # 20,000 relationship narratives just to traverse IDs and dates.
    from types import SimpleNamespace
    columns=[FamilyTreePerson.id,FamilyTreePerson.is_locked]
    names=['display_name','first_name','middle_name','last_name','maiden_name','suffix','living_status']
    columns.extend(FamilyTreePerson.facts[key].as_string().label(key) for key in names)
    columns.extend(FamilyTreePerson.facts[key].label(key) for key in ['birth_date','death_date'])
    columns.append(FamilyTreePerson.facts['aliases'][0]['name'].as_string().label('alias_name'))
    rows=session.execute(select(*columns).where(FamilyTreePerson.household_id==actor.household_id,FamilyTreePerson.archived_at.is_(None),FamilyTreePerson.merged_into_person_id.is_(None)).order_by(FamilyTreePerson.id).limit(5001)).mappings().all()
    if len(rows)>5000: error('resource_limit','Graph collection limit exceeded.',413)
    people={row['id']:SimpleNamespace(id=row['id'],is_locked=row['is_locked'],facts={**{key:row[key] for key in names+['birth_date','death_date']},'aliases':[{'name':row['alias_name']}] if row['alias_name'] else []}) for row in rows};edges=[]
    for model,kind,a,b in [(FamilyTreeParentLink,'parent','parent_person_id','child_person_id'),(FamilyTreeCareLink,'care','caregiver_person_id','recipient_person_id'),(FamilyTreePartnerEpisode,'partner','person_a_id','person_b_id')]:
        columns=[model.id,getattr(model,a).label('source'),getattr(model,b).label('target'),model.kind,model.facts['status'].as_string().label('status'),model.facts['start_date'].label('start_date'),model.facts['end_date'].label('end_date')]
        facts=session.execute(select(*columns).where(model.household_id==actor.household_id).order_by(model.id).limit(20001)).mappings().all()
        for row in facts:
            source=row['source'];target=row['target']
            if source not in people or target not in people:continue
            status=row['status'] if kind=='partner' else None
            if kind=='partner' and not history and status in {'ended','separated'}:continue
            edges.append({'id':f"{kind}:{row['id']}",'record_id':row['id'],'source_person_id':source,'target_person_id':target,'type':kind,'kind':row['kind'],'status':status,'start_date':row['start_date'],'end_date':row['end_date']})
        if len(facts)>20000 or len(edges)>20000:error('resource_limit','Graph fact limit exceeded.',413)
    return people,sorted(edges,key=lambda e:(e['type'],e['record_id']))


def encode_token(payload):
    raw=json.dumps(payload,sort_keys=True,separators=(',',':')).encode()
    proof=hmac.new(get_settings().secret_key.encode(),b'family-tree.projection.v1\0'+raw,hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(raw).decode().rstrip('=')+'.'+proof


def decode_token(token,context):
    try:
        body,proof=token.split('.')
        raw=base64.urlsafe_b64decode(body+'='*(-len(body)%4))
        expected=hmac.new(get_settings().secret_key.encode(),b'family-tree.projection.v1\0'+raw,hashlib.sha256).hexdigest()
        if not hmac.compare_digest(proof,expected):raise ValueError()
        data=json.loads(raw)
        if data['context']['household']!=context['household']:raise ValueError()
        if data['context']['revision']!=context['revision']:error('revision_conflict','This projection changed. Restart expansion.')
        if data['context']!=context or not isinstance(data['n'],int) or not isinstance(data['e'],int) or min(data['n'],data['e'])<0:raise ValueError()
        return data['n'],data['e']
    except (ValueError,KeyError,TypeError):error('validation_error','Invalid expansion token.',422)


def project(session,actor,focus=None,up=2,down=2,partners=True,history=False,care=False,max_nodes=250,max_edges=500,token=None,collapsed_up=(),collapsed_down=()):
    nodes,edges=load(session,actor,history)
    c=collection(session,actor.household_id);revision=c.revision if c else 0
    limits={'max_nodes':max_nodes,'max_edges':max_edges}
    if focus is None:focus=c.default_focus_person_id if c else None
    if focus is None:return {'graph_revision':revision,'focus_person_id':None,'nodes':[],'edges':[],'truncated':False,'expansion_token':None,'warnings':[],'projection_limits':limits}
    requested=person(session,actor.household_id,focus)
    warnings=[]
    if requested.merged_into_person_id:
        focus=requested.merged_into_person_id;warnings.append('person_merged')
    if focus not in nodes:error('validation_error','Focus is archived; choose an active person.',422)
    for pid in set(collapsed_up)|set(collapsed_down):
        if pid not in nodes:error('validation_error','Invalid collapsed branch.',422)
    parents={};children={};counts={pid:{'parents':0,'children':0,'partners':0,'care':0} for pid in nodes}
    for e in edges:
        a=e['source_person_id'];b=e['target_person_id']
        if e['type']=='parent':
            parents.setdefault(b,[]).append(a);children.setdefault(a,[]).append(b)
            counts[a]['children']+=1;counts[b]['parents']+=1
        else:
            k='partners' if e['type']=='partner' else 'care';counts[a][k]+=1;counts[b][k]+=1
    visible={focus}
    # Collapse is an edge filter, independent of how/depth endpoints are reached.
    hidden={e['id'] for e in edges if e['type']=='parent' and (e['source_person_id'] in collapsed_down or e['target_person_id'] in collapsed_up)}
    for index,depth,collapsed,direction in [(parents,up,set(collapsed_up),'up'),(children,down,set(collapsed_down),'down')]:
        frontier=[focus];seen={focus}
        for _ in range(depth):
            following=[]
            for pid in frontier:
                if pid in collapsed:
                    continue
                for target in sorted(index.get(pid,[])):
                    visible.add(target)
                    if target not in seen:seen.add(target);following.append(target)
            frontier=following
    # Kahn's algorithm detects corrupt ancestry without a generation loop.
    indegree={pid:counts[pid]['parents'] for pid in nodes}
    ready=deque(pid for pid in sorted(nodes) if indegree[pid]==0);processed=0
    while ready:
        pid=ready.popleft();processed+=1
        for target in children.get(pid,[]):
            indegree[target]-=1
            if indegree[target]==0:ready.append(target)
    if processed<len(nodes):warnings.append('stored_ancestry_cycle')
    context_nodes=set(visible)
    for e in edges:
        if ((e['type']=='partner' and partners) or (e['type']=='care' and care)) and (e['source_person_id'] in context_nodes or e['target_person_id'] in context_nodes):visible.update([e['source_person_id'],e['target_person_id']])
    lens=[e for e in edges if e['id'] not in hidden and e['source_person_id'] in visible and e['target_person_id'] in visible and (e['type']=='parent' or e['type']=='partner' and partners or e['type']=='care' and care)]
    ids=sorted(visible,key=lambda pid:(pid!=focus,pid))
    context={'household':actor.household_id,'revision':revision,'focus':focus,'up':up,'down':down,'partners':partners,'history':history,'care':care,'max_nodes':max_nodes,'max_edges':max_edges,'collapsed_up':sorted(collapsed_up),'collapsed_down':sorted(collapsed_down)}
    n,e=decode_token(token,context) if token else (0,0)
    if n>len(ids) or e>len(lens):error('validation_error','Invalid expansion position.',422)
    page_ids=set();page_edges=[]
    while e<len(lens) and len(page_edges)<max_edges:
        endpoints={lens[e]['source_person_id'],lens[e]['target_person_id']}
        if len(page_ids|endpoints)>max_nodes:break
        page_ids|=endpoints;page_edges.append(lens[e]);e+=1
    while n<len(ids):
        if ids[n] not in page_ids and len(page_ids)>=max_nodes:break
        page_ids.add(ids[n]);n+=1
    truncated=n<len(ids) or e<len(lens)
    next_token=encode_token({'context':context,'n':n,'e':e}) if truncated else None
    result=[]
    for pid in sorted(page_ids):
        p=nodes[pid];facts=p.facts
        label=facts.get('display_name') or ' '.join(facts.get(k) or '' for k in ['first_name','middle_name','last_name','maiden_name','suffix']).strip() or (facts.get('aliases') or [{'name':'Unnamed person'}])[0]['name']
        result.append({'id':pid,'display_name':label,'living_status':facts['living_status'],'birth_date':facts.get('birth_date'),'death_date':facts.get('death_date'),'is_locked':p.is_locked,'expansion_counts':counts[pid]})
    fields={'operation':'graph','household_id':actor.household_id,'revision':revision,'node_count':len(result),'edge_count':len(page_edges)}
    if truncated: emit('graph_truncated', **fields)
    warning_events(warnings, **fields)
    return {'graph_revision':revision,'focus_person_id':focus,'nodes':result,'edges':page_edges,'truncated':truncated,'expansion_token':next_token,'warnings':warnings,'projection_limits':limits}


def compare(session,actor,a,b,history=True,max_nodes=500,max_edges=1000):
    nodes,edges=load(session,actor,history)
    for pid in [a,b]:
        p=person(session,actor.household_id,pid)
        if p.merged_into_person_id:error('person_merged','Choose the canonical person for comparison.',canonical_person_id=p.merged_into_person_id)
        if pid not in nodes:error('validation_error','Choose an active person.',422)
    adjacency={}
    for e in edges:
        x=e['source_person_id'];y=e['target_person_id']
        adjacency.setdefault(x,[]).append((y,e));adjacency.setdefault(y,[]).append((x,e))
    queue=deque([a]);previous={a:None};scanned=set();truncated=False
    while queue and b not in previous:
        pid=queue.popleft()
        for target,edge in adjacency.get(pid,[]):
            if edge['id'] not in scanned and len(scanned)>=max_edges:truncated=True;break
            scanned.add(edge['id'])
            if target in previous:continue
            if len(previous)>=max_nodes:truncated=True;break
            previous[target]=(pid,edge);queue.append(target)
            if target==b:break
        if truncated:break
    connected=b in previous;path=[];ids=[]
    if connected:
        cursor=b;ids=[b]
        while cursor!=a:
            cursor,edge=previous[cursor];path.append(edge);ids.append(cursor)
        path.reverse();ids.reverse()
    c=collection(session,actor.household_id)
    if truncated:
        fields={'operation':'compare','household_id':actor.household_id,'revision':c.revision,'visited_count':len(previous),'edge_count':len(scanned)}
        emit('graph_truncated', **fields)
        warning_events(['bounded_search'], **fields)
    return {'graph_revision':c.revision,'person_a_id':a,'person_b_id':b,'state':'connected' if connected else 'truncated' if truncated else 'disconnected','distance':len(path) if connected else None,'person_ids':ids,'path':path,'warnings':['bounded_search'] if truncated else [],'projection_limits':{'max_nodes':max_nodes,'max_edges':max_edges}}
