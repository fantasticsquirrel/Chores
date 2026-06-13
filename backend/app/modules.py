from __future__ import annotations

from dataclasses import dataclass

from app.models.enums import UserRole


@dataclass(frozen=True)
class AppModule:
    key: str
    name: str
    description: str


MODULE_CHORES = "chores"
MODULE_HOMESCHOOL = "homeschool"
MODULE_ADMIN = "admin"
MODULE_RECIPES = "recipes"

AVAILABLE_MODULES: tuple[AppModule, ...] = (
    AppModule(
        key=MODULE_CHORES,
        name="Chores",
        description="Chore assignments, child submissions, approvals, and rewards.",
    ),
    AppModule(
        key=MODULE_HOMESCHOOL,
        name="Homeschool",
        description="Attendance, subjects, semesters, comments, and homeschool reporting.",
    ),
    AppModule(
        key=MODULE_RECIPES,
        name="Recipes",
        description="Personal recipe collection, categories, ingredients, scaling, and cooking notes.",
    ),
    AppModule(
        key=MODULE_ADMIN,
        name="Admin",
        description="Household users, children, account links, and module access.",
    ),
)

DEFAULT_ROLE_MODULES: dict[UserRole, tuple[str, ...]] = {
    UserRole.PARENT_ADMIN: (MODULE_CHORES, MODULE_HOMESCHOOL, MODULE_RECIPES, MODULE_ADMIN),
    UserRole.PARENT: (MODULE_CHORES, MODULE_HOMESCHOOL, MODULE_RECIPES),
    UserRole.CHILD: (MODULE_CHORES,),
}


def get_modules_for_role(role: UserRole) -> list[AppModule]:
    allowed_keys = set(DEFAULT_ROLE_MODULES.get(role, ()))
    return [module for module in AVAILABLE_MODULES if module.key in allowed_keys]
