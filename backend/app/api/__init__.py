from app.api.auth import router as auth_router
from app.api.children import router as children_router
from app.api.chores import router as chores_router
from app.api.homeschool import router as homeschool_router
from app.api.workflow import router as workflow_router
from app.api.modules import router as modules_router
from app.api.recipes import router as recipes_router
from app.api.notifications import router as notifications_router
from app.api.billing import router as billing_router
from app.api.households import router as households_router
from app.api.ops import router as ops_router

__all__ = [
    "auth_router",
    "billing_router",
    "children_router",
    "chores_router",
    "homeschool_router",
    "households_router",
    "modules_router",
    "notifications_router",
    "ops_router",
    "recipes_router",
    "workflow_router",
]
