"""Allowlisted content-free JSON events in the existing logging message output.

No event accepts arbitrary text, exceptions, payloads, tokens or paths. Consumers
count by event/code/operation, not IDs (avoid high-cardinality metric labels).
Correlation is read-only: only canonical UUID request IDs are copied; absent or
untrusted correlation is omitted. ContextVars propagate into sync threadpool work.
"""
from contextlib import contextmanager
from contextvars import ContextVar
from functools import wraps
import json
import logging
import re
from fastapi import HTTPException
from pydantic import ValidationError

logger = logging.getLogger(__name__)
_REQUEST_ID: ContextVar[str | None] = ContextVar('family_tree_request_id', default=None)
_OPERATION: ContextVar[str | None] = ContextVar('family_tree_operation', default=None)
_HOUSEHOLD: ContextVar[int | None] = ContextVar('family_tree_household_id', default=None)
EVENTS = frozenset({'domain_rejected','graph_truncated','validation_warning',
    'staging_failed','staging_expired','quota_rejected','admission_rejected',
    'cleanup_completed','cleanup_failed','backup_failed','rehearse_failed',
    'operator_failed','operator_completed'})
OPERATIONS = frozenset({'graph','compare','mutation','import','export','merge','purge',
    'cleanup','backup','rehearse','request'})
WARNINGS = frozenset({'chronology_review','similar_partner_episode','person_merged',
    'stored_ancestry_cycle','bounded_search'})
CODES = WARNINGS | frozenset({'revision_conflict','person_locked','relationship_cycle',
    'identity_link_conflict','idempotency_conflict','integrity_conflict','resource_limit',
    'validation_error','server_busy','merge_aliases_present','merge_conflict',
    'transfer_expired','media_unavailable','storage_unavailable','io_error',
    'timeout','unexpected_error','interrupted','invalid_arguments'})
NUMBERS = frozenset({'household_id','job_id','revision','node_count','edge_count',
    'visited_count','warning_count','count','limit','byte_count','expired_jobs',
    'deleted_assets','orphan_files','expired_pins','objects','artifacts','status'})
EXCEPTION_TYPES = frozenset({'HTTPException','ValidationError','ValueError','OSError',
    'FileNotFoundError','PermissionError','TimeoutError','RuntimeError','EOFError',
    'IntegrityError','OperationalError','BadZipFile','KeyboardInterrupt','SystemExit',
    'OtherError'})
_UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')


def emit(event, **fields):
    """Return/log only a fixed schema; fields must reach plain-text handlers."""
    if event not in EVENTS:
        return None
    payload = {'event': event}
    values = {'request_id':_REQUEST_ID.get(), 'operation':_OPERATION.get(),
              'household_id':_HOUSEHOLD.get(), **fields}
    for key, value in values.items():
        if key in NUMBERS and type(value) is int and 0 <= value <= 2**63-1:
            payload[key] = value
        elif key == 'request_id' and isinstance(value,str) and _UUID.fullmatch(value):
            payload[key] = value
        elif key == 'operation' and isinstance(value,str) and value in OPERATIONS:
            payload[key] = value
        elif key == 'code' and isinstance(value,str) and value in CODES:
            payload[key] = value
        elif key == 'exception_type' and isinstance(value,str) and value in EXCEPTION_TYPES:
            payload[key] = value
    # No logging extra/exception object: default logging formatter prints message.
    level = logging.ERROR if event.endswith('_failed') else logging.INFO
    logger.log(level, json.dumps(payload, sort_keys=True, separators=(',',':')))
    return payload


@contextmanager
def correlation(request_id):
    token = _REQUEST_ID.set(request_id if isinstance(request_id,str) and _UUID.fullmatch(request_id) else None)
    try:
        yield
    finally:
        _REQUEST_ID.reset(token)


@contextmanager
def operation_context(operation, household_id=None):
    op = _OPERATION.set(operation if operation in OPERATIONS else None)
    household = _HOUSEHOLD.set(household_id if type(household_id) is int else None)
    try:
        yield
    finally:
        _HOUSEHOLD.reset(household); _OPERATION.reset(op)


def warning_events(warnings, **fields):
    # Deliberately do not stringify unknown warnings or serialize their contents.
    known = {code for code in warnings if isinstance(code,str) and code in WARNINGS}
    for code in sorted(known):
        emit('validation_warning', code=code, warning_count=len(known), **fields)


def classify(exc):
    if isinstance(exc,HTTPException):
        detail=exc.detail
        code=detail.get('code') if isinstance(detail,dict) else None
        code=code if isinstance(code,str) and code in CODES else 'unexpected_error'
    elif isinstance(exc,TimeoutError): code='timeout'
    elif isinstance(exc,OSError): code='io_error'
    elif isinstance(exc,(ValueError,ValidationError)): code='validation_error'
    elif isinstance(exc,(KeyboardInterrupt,SystemExit)): code='interrupted'
    else: code='unexpected_error'
    name=type(exc).__name__
    return {'code':code, 'exception_type':name if name in EXCEPTION_TYPES else 'OtherError'}


def operation_events(operation):
    """Safe failure boundary; never swallow/replace exceptions or log inputs."""
    if operation not in {'import','export','cleanup','backup','rehearse'}:
        raise ValueError('Unsupported event operation')
    def decorate(function):
        @wraps(function)
        def wrapped(*args, **kwargs):
            actor=kwargs.get('actor') or (args[1] if operation in {'import','export'} and len(args)>1 else None)
            household_id=getattr(actor,'household_id',None)
            with operation_context(operation,household_id):
                try:
                    return function(*args,**kwargs)
                except BaseException as exc:
                    event='staging_failed' if operation in {'import','export'} else operation+'_failed'
                    emit(event, **classify(exc))
                    raise
        return wrapped
    return decorate
