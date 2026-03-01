from app.api.auth import router as auth_router
from app.api.children import router as children_router
from app.api.chores import router as chores_router
from app.api.workflow import router as workflow_router

__all__ = ["auth_router", "children_router", "chores_router", "workflow_router"]
