"""Foundation review regressions exercised through both real schema paths."""
import pytest
from sqlalchemy import select, text
from test_family_tree_api import tree, create, person_id, BASE
from app.models import User
from app.models.family_tree import FamilyTreeCollection, FamilyTreePerson, FamilyTreeOtherName, FamilyTreeMediaAsset, FamilyTreeMediaPin, FamilyTreeImportSourceKey

pytestmark = pytest.mark.parametrize('tree', [False, True], indirect=True)


def test_overlapping_person_ranges_require_review_and_rollback(tree):
    c, factory, _ = tree
    body = {'expected_graph_revision': 0, 'idempotency_key': 'overlap', 'person': {'first_name': 'A', 'birth_date': {'value': '2000'}, 'death_date': {'value': '2000-02'}}}
    r = c.post(BASE+'/people', json=body)
    assert r.status_code == 422 and r.json()['detail']['code'] == 'chronology_review', r.text
    assert c.get(BASE+'/').json()['graph_revision'] == 0
    assert c.get(BASE+'/people').json()['total'] == 0
    body['reviewed_warnings'] = ['chronology_review']
    p = person_id(c.post(BASE+'/people', json=body))
    assert c.patch(BASE+f'/people/{p}', json={'expected_graph_revision': 1, 'changes': {'death_date': {'value': '2000-03'}}}).status_code == 422
    assert c.get(BASE+f'/people/{p}').json()['person']['death_date']['value'] == '2000-02'
    assert c.get(BASE+'/').json()['graph_revision'] == 1
    assert create(c, 1, 'Same day', 'same', birth_date={'value':'2001-01-01'}, death_date={'value':'2001-01-01'}).status_code == 200
    assert create(c, 2, 'Impossible', 'bad', birth_date={'value':'2002'}, death_date={'value':'2001'}).status_code == 422


@pytest.mark.parametrize('kind', ['residence', 'care', 'partner'])
def test_overlapping_episode_create_patch_review(tree, kind):
    c, _, _ = tree
    a = person_id(create(c)); b = person_id(create(c,1,'B','b'))
    dates = {'start_date': {'value':'2000'}, 'end_date': {'value':'2000-02'}}
    if kind == 'residence':
        path=f'/people/{a}/residences'; data={'residence':{'place':'Home',**dates}}; key='residence_ids'; patch='/residences/'
    else:
        path='/care-links' if kind=='care' else '/partner-episodes'
        data=({'caregiver_person_id':a,'recipient_person_id':b,'kind':'guardian'} if kind=='care' else {'person_a_id':a,'person_b_id':b,'kind':'partners'}) | dates
        key='relationship_ids'; patch=path+'/'
    body={'expected_graph_revision':2,**data}
    assert c.post(BASE+path,json=body).status_code == 422
    assert c.get(BASE+'/').json()['graph_revision'] == 2
    r=c.post(BASE+path,json={**body,'reviewed_warnings':['chronology_review']})
    assert r.status_code == 200, r.text
    rid=r.json()['affected'][key][0]
    assert c.patch(BASE+patch+str(rid),json={'expected_graph_revision':3,'changes':{'end_date':{'value':'2000-03'}}}).status_code == 422
    assert c.get(BASE+'/').json()['graph_revision'] == 3


@pytest.mark.parametrize('direction', ['down','up','partner','care'])
def test_collapsed_parent_edges_stay_hidden_at_boundary_and_context(tree, direction):
    c, _, _ = tree
    a=person_id(create(c));b=person_id(create(c,1,'B','b'));d=person_id(create(c,2,'C','c'))
    rev=3
    for x,y in [(a,b),(a,d),(b,d)]:
        assert c.post(BASE+'/parent-links',json={'expected_graph_revision':rev,'parent_person_id':x,'child_person_id':y,'kind':'biological'}).status_code==200
        rev+=1
    params={'focus_person_id':a,'up_depth':0,'down_depth':1,'collapsed_down_ids':b}
    if direction=='up': params={'focus_person_id':d,'up_depth':1,'down_depth':0,'collapsed_up_ids':b}
    elif direction in {'partner','care'}:
        path='/partner-episodes' if direction=='partner' else '/care-links'
        data={'person_a_id':a,'person_b_id':b,'kind':'partners','status':'current'} if direction=='partner' else {'caregiver_person_id':a,'recipient_person_id':b,'kind':'caregiver'}
        assert c.post(BASE+path,json={'expected_graph_revision':rev,**data}).status_code==200
        params.update(down_depth=0,include_care=True)
        # Both endpoints become context nodes without ancestry traversal.
        assert c.post(BASE+'/partner-episodes',json={'expected_graph_revision':rev+1,'person_a_id':a,'person_b_id':d,'kind':'partners','status':'current'}).status_code==200
    r=c.get(BASE+'/graph',params=params).json()
    assert {n['id'] for n in r['nodes']}=={a,b,d}
    assert not any(e['type']=='parent' and ((e['target_person_id']==b) if direction=='up' else (e['source_person_id']==b)) for e in r['edges']), r


def test_unknown_partner_is_not_history_and_maiden_name_labels(tree):
    c, _, _=tree
    a=person_id(c.post(BASE+'/people',json={'expected_graph_revision':0,'idempotency_key':'maiden','person':{'maiden_name':'Earlier'}}))
    b=person_id(create(c,1,'B','b'))
    assert c.post(BASE+'/partner-episodes',json={'expected_graph_revision':2,'person_a_id':a,'person_b_id':b,'kind':'unknown','status':'unknown'}).status_code==200
    graph=c.get(BASE+'/graph',params={'focus_person_id':a,'include_history':False}).json()
    assert graph['edges'] and graph['edges'][0]['status']=='unknown', graph
    assert next(n for n in graph['nodes'] if n['id']==a)['display_name']=='Earlier'
    assert c.get(BASE+'/compare',params={'person_a_id':a,'person_b_id':b,'include_history':False}).json()['state']=='connected'


def test_unlinked_creator_deletion_invalidates_once_and_preserves_facts(tree):
    c,factory,ids=tree
    p=person_id(create(c,aliases=[{'name':'Alias'}]))
    with factory() as s:
        creator=ids['parent']; col=s.scalar(select(FamilyTreeCollection))
        s.get(FamilyTreePerson,p).created_by_user_id=creator
        s.get(FamilyTreePerson,p).locked_by_user_id=creator
        s.scalar(select(FamilyTreeOtherName)).created_by_user_id=creator
        s.add(FamilyTreeMediaAsset(household_id=col.household_id,collection_id=col.id,created_by_user_id=creator,object_key='a'*64,mime_type='image/png',byte_size=1,checksum='b'*64,width=1,height=1,state='ready'))
        s.flush(); s.commit()
        s.execute(text('DELETE FROM users WHERE id=:id'),{'id':creator});s.commit()
    detail=c.get(BASE+f'/people/{p}').json()
    assert detail['graph_revision']==2, detail
    assert detail['person']['display_name']=='Morgan'
    assert detail['person']['created_by_user_id'] is None
    assert detail['person']['aliases'][0]['created_by_user_id'] is None
    with factory() as s: assert s.scalar(select(FamilyTreeMediaAsset)).created_by_user_id is None


def test_maiden_only_label_is_supported_without_surname(tree):
    c, _, _ = tree
    p = person_id(c.post(BASE+'/people',json={'expected_graph_revision':0,'idempotency_key':'name','person':{'maiden_name':'Earlier'}}))
    graph=c.get(BASE+'/graph',params={'focus_person_id':p}).json()
    assert graph['nodes'][0]['display_name']=='Earlier'


def test_story_partial_dates_calendar_validation_and_rollback(tree):
    c, _, _ = tree
    p=person_id(create(c))
    r=c.post(BASE+f'/people/{p}/stories',json={'expected_graph_revision':1,'idempotency_key':'dated','story':{'title':'History','body_md':'Kept','date':{'value':'2000-02'}}})
    assert r.status_code==200, r.text
    sid=r.json()['affected']['story_ids'][0]
    assert c.patch(BASE+f'/stories/{sid}',json={'expected_graph_revision':2,'changes':{'date':{'value':'2000-02-30'}}}).status_code==422
    assert c.get(BASE+'/').json()['graph_revision']==2
    story=c.get(BASE+f'/people/{p}/stories').json()['items'][0]
    assert story['date']=={'value':'2000-02','precision':'month','uncertain':False}


def test_import_and_merge_share_overlap_review(tree,tmp_path,monkeypatch):
    import json
    monkeypatch.setenv('FAMILY_TREE_STORAGE_ROOT',str(tmp_path/'private'))
    c, _, _ = tree
    a=person_id(create(c,birth_date={'value':'2000'}))
    b=person_id(create(c,1,'B','b',death_date={'value':'2000-02'}))
    preview=c.post(BASE+'/merge-preview',json={'expected_graph_revision':2,'source_person_id':a,'target_person_id':b,'scalar_choices':{'display_name':'target'}})
    assert preview.status_code==200, preview.text
    assert preview.json()['summary']['warnings']==['chronology_review'],preview.text
    body={'expected_graph_revision':2,'idempotency_key':'reviewed-merge','preview_token':preview.json()['preview_token']}
    assert c.post(BASE+'/merge',json=body).status_code==422
    assert c.get(BASE+'/').json()['graph_revision']==2
    assert c.get(BASE+f'/people/{a}').json()['person']['merged_into_person_id'] is None
    result=c.post(BASE+'/merge',json={**body,'reviewed_warnings':['chronology_review']})
    assert result.status_code==200,result.text
    assert result.json()['warnings']==['chronology_review']
    exp=c.post(BASE+'/exports',json={'format':'json'}).json()['id']
    data=c.get(BASE+f'/exports/{exp}/download').content
    staged=c.post(BASE+'/imports',data={'expected_graph_revision':'3'},files={'file':('tree.json',data,'application/json')})
    assert staged.status_code==200,staged.text
    assert staged.json()['summary']['warnings']==['chronology_review']
    commit={'expected_graph_revision':3,'idempotency_key':'reviewed-import','confirmed':True}
    assert c.post(BASE+f'/imports/{staged.json()["id"]}/commit',json=commit).status_code==422
    assert c.get(BASE+'/').json()['graph_revision']==3
    assert c.get(BASE+'/people').json()['total']==1
    result=c.post(BASE+f'/imports/{staged.json()["id"]}/commit',json={**commit,'reviewed_warnings':['chronology_review']})
    assert result.status_code==200,result.text
    assert result.json()['warnings']==['chronology_review']
