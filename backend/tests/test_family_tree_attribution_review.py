"""Every user FK surface invalidates before direct deletion on both schemas."""
from datetime import UTC, datetime, timedelta
import pytest
from sqlalchemy import select, text
from test_family_tree_api import tree, create, person_id
from app.models import User
from app.models.family_tree import *

pytestmark=pytest.mark.parametrize('tree',[False,True],indirect=True)


def test_every_user_attribution_surface_invalidates_before_fk_actions(tree):
    c,factory,ids=tree
    a=person_id(create(c));b=person_id(create(c,1,'B','b'))
    with factory() as s:
        col=s.scalar(select(FamilyTreeCollection));cid=col.id
        scope={'household_id':col.household_id,'collection_id':col.id,'created_by_user_id':ids['owner']}
        asset=FamilyTreeMediaAsset(**scope,object_key='d'*64,mime_type='image/png',byte_size=1,checksum='e'*64,width=1,height=1,state='ready')
        s.add(asset);s.flush()
        s.add_all([
            FamilyTreePersonTag(**scope,person_id=a,tag='test'),
            FamilyTreeOtherName(**scope,person_id=a,name='Alias',position=0),
            FamilyTreeParentLink(**scope,parent_person_id=a,child_person_id=b,kind='biological',facts={}),
            FamilyTreeCareLink(**scope,caregiver_person_id=a,recipient_person_id=b,kind='guardian',facts={}),
            FamilyTreePartnerEpisode(**scope,person_a_id=a,person_b_id=b,kind='partners',facts={'status':'unknown'}),
            FamilyTreeStory(**scope,person_id=a,position=0,facts={'title':'Kept','body_md':'Kept'}),
            FamilyTreeResidence(**scope,person_id=a,facts={'place':'Kept'},is_primary=False),
            FamilyTreeIdentityLink(**scope,person_id=a,user_id=ids['parent']),
            FamilyTreeMediaReference(**scope,person_id=a,asset_id=asset.id,role='primary'),
            FamilyTreeMediaPin(**scope,asset_id=asset.id,token='f'*64,purpose='backup',expires_at=datetime.now(UTC)+timedelta(days=30)),
            FamilyTreeImportSourceKey(**scope,person_id=a,package_digest='a'*64,source_key='p:1',provenance={}),
            FamilyTreeTransferJob(household_id=col.household_id,collection_id=cid,actor_user_id=ids['owner'],token='b'*64,kind='export',state='ready',expected_revision=2,payload={},summary={},expires_at=datetime.now(UTC)+timedelta(days=1)),
        ]);s.commit()
        examined=[]
        for model in FAMILY_TREE_MODELS:
            table=model.__table__
            for field in ('created_by_user_id','locked_by_user_id','actor_user_id','user_id'):
                if field not in table.c:continue
                row=s.scalar(select(model));assert row is not None,table.name
                actor=User(household_id=ids['household'],email=f'attribution-{len(examined)}@example.test',password_hash='unused',role='PARENT');s.add(actor);s.flush()
                rid=row.id;actor_id=actor.id
                setattr(row,field,actor_id);s.commit()
                before=s.get(FamilyTreeCollection,cid).revision
                s.execute(text('DELETE FROM users WHERE id=:id'),{'id':actor_id});s.commit();s.expire_all()
                assert s.get(FamilyTreeCollection,cid).revision==before+1,(table.name,field)
                remaining=s.get(model,rid)
                if field in {'actor_user_id','user_id'}:assert remaining is None
                else:assert remaining is not None and getattr(remaining,field) is None
                examined.append((table.name,field))
        assert len(examined)==18,examined
        assert s.get(FamilyTreePerson,a).facts['display_name']=='Morgan'
        assert s.get(FamilyTreeMediaAsset,asset.id).state=='ready'
        assert s.scalar(select(FamilyTreeMediaPin)).purpose=='backup'
