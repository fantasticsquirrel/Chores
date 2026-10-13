"""Adult-only, explicitly guarded thin genealogy routes (FT-0/FT-1)."""
from typing import Annotated, Literal
from fastapi import APIRouter,Depends,Query,Path
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError,OperationalError
from app.services.family_tree.access import error
from app.api.dependencies import get_db_session,require_module_view,require_module_manage
from app.models import User
from app.models.enums import UserRole
from app.schemas import family_tree as dto
from app.services.family_tree import people,relationships,records,identity,graph
from app.services.family_tree.mutations import execute

router=APIRouter(prefix='/family-tree',tags=['family-tree'],responses={status:{'model':dto.DomainErrorResponse} for status in [401,403,404,409,413,503]})
View=Annotated[User,Depends(require_module_view('family-tree',UserRole.PARENT_ADMIN,UserRole.PARENT))]
Manage=Annotated[User,Depends(require_module_manage('family-tree',UserRole.PARENT_ADMIN,UserRole.PARENT))]
DB=Annotated[Session,Depends(get_db_session)]
PositivePath=Annotated[int,Path(gt=0)]


def read_snapshot(session:DB):
    # pysqlite otherwise does not start a transaction for SELECT; without an
    # explicit BEGIN, a multi-query DTO could claim a mixed graph revision.
    connection=session.connection()
    if connection.dialect.name=='sqlite' and not connection.connection.driver_connection.in_transaction:
        connection.exec_driver_sql('BEGIN')
    return session

ReadDB=Annotated[Session,Depends(read_snapshot)]

def commit(session,result):
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        error('integrity_conflict','A conflicting record or concurrent command exists.')
    except OperationalError:
        session.rollback()
        error('server_busy','The server is busy. Refresh and retry with the same key.',503)
    return result

@router.get('/',response_model=dto.CollectionState)
def collection_state(user:View,session:ReadDB):
    return people.state(session,user)

@router.get('/people',response_model=dto.PeoplePage)
def directory(user:View,session:ReadDB,query:Annotated[str,Query(max_length=500)]='',tag:Annotated[str|None,Query(max_length=100)]=None,living_status:Literal['living','deceased','unknown']|None=None,archived:bool=False,cursor:Annotated[int|None,Query(gt=0)]=None,limit:Annotated[int,Query(ge=1,le=100)]=50):
    return people.directory(session,user,query,tag,living_status,archived,cursor,limit)

@router.get('/people/{person_id}',response_model=dto.PersonDetail)
def detail(person_id:PositivePath,user:View,session:ReadDB):
    return people.detail(session,user,person_id)

@router.get('/graph',response_model=dto.GraphProjection)
def graph_projection(user:View,session:ReadDB,focus_person_id:Annotated[int|None,Query(gt=0)]=None,up_depth:Annotated[int,Query(ge=0,le=10)]=2,down_depth:Annotated[int,Query(ge=0,le=10)]=2,include_partners:bool=True,include_history:bool=False,include_care:bool=False,max_nodes:Annotated[int,Query(ge=2,le=500)]=250,max_edges:Annotated[int,Query(ge=1,le=1000)]=500,expansion_token:Annotated[str|None,Query(max_length=4000)]=None,collapsed_up_ids:Annotated[list[int]|None,Query(max_length=500)]=None,collapsed_down_ids:Annotated[list[int]|None,Query(max_length=500)]=None):
    return graph.project(session,user,focus_person_id,up_depth,down_depth,include_partners,include_history,include_care,max_nodes,max_edges,expansion_token,collapsed_up_ids or [],collapsed_down_ids or [])

@router.get('/compare',response_model=dto.CompareResult)
def compare_people(user:View,session:ReadDB,person_a_id:Annotated[int,Query(gt=0)],person_b_id:Annotated[int,Query(gt=0)],include_history:bool=True,max_nodes:Annotated[int,Query(ge=2,le=500)]=500,max_edges:Annotated[int,Query(ge=1,le=1000)]=1000):
    return graph.compare(session,user,person_a_id,person_b_id,include_history,max_nodes,max_edges)

@router.get('/identity-candidates',response_model=dto.IdentityCandidates)
def identity_candidates(user:Manage,session:ReadDB):
    return identity.candidates(session,user)

@router.post('/people',response_model=dto.MutationResult)
def create_person(body:dto.CreatePerson,user:Manage,session:DB):
    def action(c):
        p,warnings=people.add(session,user,c,body.person)
        return {'person_ids':[p.id]},warnings
    return commit(session,execute(session,user,'person.create',body,action))

@router.patch('/people/{person_id}',response_model=dto.MutationResult)
def patch_person(person_id:PositivePath,body:dto.PatchPerson,user:Manage,session:DB):
    return commit(session,execute(session,user,f'person.patch:{person_id}',body,lambda c:people.edit(session,user,c,person_id,body.changes)))

@router.post('/relatives',response_model=dto.MutationResult)
def create_relative(body:dto.CreateRelative,user:Manage,session:DB):
    return commit(session,execute(session,user,'relative.create',body,lambda c:relationships.relative(session,user,c,body)))

@router.post('/people/{person_id}/archive',response_model=dto.MutationResult)
def archive_person(person_id:PositivePath,body:dto.Command,user:Manage,session:DB):
    return commit(session,execute(session,user,f'person.archive:{person_id}',body,lambda c:people.lifecycle(session,user,c,person_id,'archive')))

@router.post('/people/{person_id}/restore',response_model=dto.MutationResult)
def restore_person(person_id:PositivePath,body:dto.Command,user:Manage,session:DB):
    return commit(session,execute(session,user,f'person.restore:{person_id}',body,lambda c:people.lifecycle(session,user,c,person_id,'restore')))

@router.post('/people/{person_id}/lock',response_model=dto.MutationResult)
def lock_person(person_id:PositivePath,body:dto.ReasonCommand,user:Manage,session:DB):
    return commit(session,execute(session,user,f'person.lock:{person_id}',body,lambda c:people.lifecycle(session,user,c,person_id,'lock',body.reason)))

@router.post('/people/{person_id}/unlock',response_model=dto.MutationResult)
def unlock_person(person_id:PositivePath,body:dto.ReasonCommand,user:Manage,session:DB):
    return commit(session,execute(session,user,f'person.unlock:{person_id}',body,lambda c:people.lifecycle(session,user,c,person_id,'unlock',body.reason)))

@router.post('/parent-links',response_model=dto.MutationResult)
def post_parent_links(body:dto.CreateParent,user:Manage,session:DB):
    return commit(session,execute(session,user,'parent_links.post',body,lambda c:relationships.change(session,user,c,'parent-links',data=body)))

@router.patch('/parent-links/{relationship_id}',response_model=dto.MutationResult)
def patch_parent_links(relationship_id:PositivePath,body:dto.PatchParent,user:Manage,session:DB):
    return commit(session,execute(session,user,f'parent_links.patch:{relationship_id}',body,lambda c:relationships.change(session,user,c,'parent-links',rid=relationship_id,changes=body.changes)))

@router.delete('/parent-links/{relationship_id}',response_model=dto.MutationResult)
def delete_parent_links(relationship_id:PositivePath,body:dto.Command,user:Manage,session:DB):
    return commit(session,execute(session,user,f'parent_links.delete:{relationship_id}',body,lambda c:relationships.change(session,user,c,'parent-links',rid=relationship_id,remove=True)))

@router.post('/care-links',response_model=dto.MutationResult)
def post_care_links(body:dto.CreateCare,user:Manage,session:DB):
    return commit(session,execute(session,user,'care_links.post',body,lambda c:relationships.change(session,user,c,'care-links',data=body)))

@router.patch('/care-links/{relationship_id}',response_model=dto.MutationResult)
def patch_care_links(relationship_id:PositivePath,body:dto.PatchCare,user:Manage,session:DB):
    return commit(session,execute(session,user,f'care_links.patch:{relationship_id}',body,lambda c:relationships.change(session,user,c,'care-links',rid=relationship_id,changes=body.changes)))

@router.delete('/care-links/{relationship_id}',response_model=dto.MutationResult)
def delete_care_links(relationship_id:PositivePath,body:dto.Command,user:Manage,session:DB):
    return commit(session,execute(session,user,f'care_links.delete:{relationship_id}',body,lambda c:relationships.change(session,user,c,'care-links',rid=relationship_id,remove=True)))

@router.post('/partner-episodes',response_model=dto.MutationResult)
def post_partner_episodes(body:dto.CreatePartner,user:Manage,session:DB):
    return commit(session,execute(session,user,'partner_episodes.post',body,lambda c:relationships.change(session,user,c,'partner-episodes',data=body)))

@router.patch('/partner-episodes/{relationship_id}',response_model=dto.MutationResult)
def patch_partner_episodes(relationship_id:PositivePath,body:dto.PatchPartner,user:Manage,session:DB):
    return commit(session,execute(session,user,f'partner_episodes.patch:{relationship_id}',body,lambda c:relationships.change(session,user,c,'partner-episodes',rid=relationship_id,changes=body.changes)))

@router.delete('/partner-episodes/{relationship_id}',response_model=dto.MutationResult)
def delete_partner_episodes(relationship_id:PositivePath,body:dto.Command,user:Manage,session:DB):
    return commit(session,execute(session,user,f'partner_episodes.delete:{relationship_id}',body,lambda c:relationships.change(session,user,c,'partner-episodes',rid=relationship_id,remove=True)))

@router.get('/people/{person_id}/stories',response_model=dto.StoriesPage)
def list_stories(person_id:PositivePath,user:View,session:ReadDB,limit:Annotated[int,Query(ge=1,le=100)]=50,cursor:Annotated[int|None,Query(gt=0)]=None):
    return records.page(session,user,person_id,'stories',limit,cursor)

@router.post('/people/{person_id}/stories',response_model=dto.MutationResult)
def create_story(person_id:PositivePath,body:dto.CreateStory,user:Manage,session:DB):
    return commit(session,execute(session,user,f'story.create:{person_id}',body,lambda c:records.change(session,user,c,'stories',pid=person_id,data=body.story)))

@router.patch('/stories/{record_id}',response_model=dto.MutationResult)
def patch_story(record_id:PositivePath,body:dto.PatchStory,user:Manage,session:DB):
    return commit(session,execute(session,user,f'story.patch:{record_id}',body,lambda c:records.change(session,user,c,'stories',rid=record_id,changes=body.changes)))

@router.delete('/stories/{record_id}',response_model=dto.MutationResult)
def delete_story(record_id:PositivePath,body:dto.Command,user:Manage,session:DB):
    return commit(session,execute(session,user,f'story.delete:{record_id}',body,lambda c:records.change(session,user,c,'stories',rid=record_id,remove=True)))

@router.get('/people/{person_id}/residences',response_model=dto.ResidencesPage)
def list_residences(person_id:PositivePath,user:View,session:ReadDB,limit:Annotated[int,Query(ge=1,le=100)]=50,cursor:Annotated[int|None,Query(gt=0)]=None):
    return records.page(session,user,person_id,'residences',limit,cursor)

@router.post('/people/{person_id}/residences',response_model=dto.MutationResult)
def create_residence(person_id:PositivePath,body:dto.CreateResidence,user:Manage,session:DB):
    return commit(session,execute(session,user,f'residence.create:{person_id}',body,lambda c:records.change(session,user,c,'residences',pid=person_id,data=body.residence)))

@router.patch('/residences/{record_id}',response_model=dto.MutationResult)
def patch_residence(record_id:PositivePath,body:dto.PatchResidence,user:Manage,session:DB):
    return commit(session,execute(session,user,f'residence.patch:{record_id}',body,lambda c:records.change(session,user,c,'residences',rid=record_id,changes=body.changes)))

@router.delete('/residences/{record_id}',response_model=dto.MutationResult)
def delete_residence(record_id:PositivePath,body:dto.Command,user:Manage,session:DB):
    return commit(session,execute(session,user,f'residence.delete:{record_id}',body,lambda c:records.change(session,user,c,'residences',rid=record_id,remove=True)))

@router.post('/people/{person_id}/stories/reorder',response_model=dto.MutationResult)
def reorder_stories(person_id:PositivePath,body:dto.ReorderStories,user:Manage,session:DB):
    return commit(session,execute(session,user,f'story.reorder:{person_id}',body,lambda c:records.reorder(session,user,c,person_id,body.story_ids)))

@router.put('/people/{person_id}/identity-link',response_model=dto.MutationResult)
def link_identity(person_id:PositivePath,body:dto.LinkIdentity,user:Manage,session:DB):
    return commit(session,execute(session,user,f'identity.link:{person_id}',body,lambda c:identity.change(session,user,c,person_id,body)))

@router.delete('/people/{person_id}/identity-link',response_model=dto.MutationResult)
def unlink_identity(person_id:PositivePath,body:dto.Command,user:Manage,session:DB):
    return commit(session,execute(session,user,f'identity.unlink:{person_id}',body,lambda c:identity.change(session,user,c,person_id,body,remove=True)))

# Register real FT-3 endpoints before main includes this router.
from app.api import family_tree_transfer  # noqa: E402,F401
