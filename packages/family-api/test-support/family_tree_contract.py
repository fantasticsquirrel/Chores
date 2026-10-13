"""Read real router OpenAPI and validate submitted transport bodies, no DB writes.

Run with the backend's Python dependencies installed. The TypeScript suite uses
FAMILY_TREE_CONTRACT_PYTHON when the backend lives in a separate virtualenv.
"""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend"))
from fastapi import FastAPI
from pydantic import BaseModel, ValidationError
from app.api.family_tree import router
from app.schemas import family_tree as dto
from app.services.family_tree.access import error
from fastapi import HTTPException

app = FastAPI()
app.include_router(router)
schemas = {
    name: model.model_json_schema()
    for name, model in vars(dto).items()
    if isinstance(model, type) and issubclass(model, BaseModel)
    and model.__module__ == dto.__name__ and name != "Strict"
}
validations = []
for case in json.load(sys.stdin):
    try:
        model = getattr(dto, case["schema"]).model_validate(case["body"])
        validations.append({"valid": True, "body": model.model_dump(mode="json", exclude_unset=True)})
    except ValidationError as exc:
        validations.append({"valid": False, "errors": json.loads(exc.json(include_url=False))})
error_examples = []
for code, extra in [("person_locked", {}), ("person_merged", {"canonical_person_id": 7}), ("chronology_review", {"warnings": ["chronology_review"]})]:
    try:
        error(code, "Refresh before retrying.", **extra)
    except HTTPException as exc:
        error_examples.append({"detail": exc.detail})
print(json.dumps({"openapi": app.openapi(), "schemas": schemas, "validations": validations, "error_examples": error_examples}))
