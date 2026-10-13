from test_family_tree_api import tree,create,person_id,BASE


def test_graph_typed_care_and_repeated_partner_history(tree):
    c,_,_=tree
    a=person_id(create(c));b=person_id(create(c,1,'B','b'));d=person_id(create(c,2,'Disconnected','d'))
    assert c.post(BASE+'/care-links',json={'expected_graph_revision':3,'caregiver_person_id':a,'recipient_person_id':b,'kind':'guardian'}).status_code==200
    for rev,status in [(4,'ended'),(5,'current')]:
        assert c.post(BASE+'/partner-episodes',json={'expected_graph_revision':rev,'person_a_id':b,'person_b_id':a,'kind':'partners','status':status}).status_code==200
    graph=c.get(BASE+'/graph',params={'focus_person_id':a,'include_care':True,'include_history':True})
    assert graph.status_code==200
    data=graph.json();assert {n['id'] for n in data['nodes']}=={a,b}
    assert [e['type'] for e in data['edges']].count('partner')==2
    assert any(e['type']=='care' and e['kind']=='guardian' for e in data['edges'])
    current=c.get(BASE+'/graph',params={'focus_person_id':a,'include_history':False}).json()
    assert [e['status'] for e in current['edges'] if e['type']=='partner']==['current']
    compare=c.get(BASE+'/compare',params={'person_a_id':a,'person_b_id':b}).json()
    assert compare['state']=='connected' and compare['distance']==1
    assert compare['path'][0]['type']=='care' and compare['path'][0]['kind']=='guardian'
    assert c.get(BASE+'/compare',params={'person_a_id':a,'person_b_id':d}).json()['state']=='disconnected'


def test_graph_bounds_continuation_binding_and_collapse(tree):
    c,_,_=tree
    a=person_id(create(c));children=[];rev=1
    for i in range(4):
        result=c.post(BASE+'/relatives',json={'expected_graph_revision':rev,'idempotency_key':f'child{i}','anchor_person_id':a,'relationship':{'direction':'child','kind':'biological'},'person':{'display_name':f'Child {i}'}}).json()
        children.append(next(pid for pid in result['affected']['person_ids'] if pid!=a));rev+=1
    params={'focus_person_id':a,'max_nodes':2,'max_edges':2}
    result=c.get(BASE+'/graph',params=params)
    assert result.status_code==200
    data=result.json();assert data['truncated'] and len(data['nodes'])==2
    assert data['expansion_token']
    next_page=c.get(BASE+'/graph',params={**params,'expansion_token':data['expansion_token']})
    assert next_page.status_code==200 and next_page.json()['nodes']!=data['nodes']
    assert c.get(BASE+'/graph',params={**params,'focus_person_id':children[0],'expansion_token':data['expansion_token']}).status_code==422
    assert c.get(BASE+'/graph',params={'focus_person_id':a,'max_nodes':501}).status_code==422
    assert c.get(BASE+'/graph',params={'focus_person_id':a,'collapsed_down_ids':a}).json()['edges']==[]
    person_id(create(c,rev,'New','new'))
    assert c.get(BASE+'/graph',params={**params,'expansion_token':data['expansion_token']}).json()['detail']['code']=='revision_conflict'


def test_graph_loading_excludes_story_sized_person_notes(tree):
    c,factory,ids=tree
    a=person_id(create(c,notes_md='Sensitive long notes'))
    from app.models import User
    from app.services.family_tree.graph import load
    with factory() as s:
        nodes,edges=load(s,s.get(User,ids['owner']))
        assert 'notes_md' not in nodes[a].facts
