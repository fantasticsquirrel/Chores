from __future__ import annotations

import ipaddress
import socket
from collections.abc import Iterable
from urllib.parse import urlsplit


class UnsafeOutboundUrl(ValueError):
    """Raised when an outbound URL can target a non-public network."""


def validate_outbound_url(url: str, *, allowed_schemes: Iterable[str] = ("https",)) -> str:
    parsed = urlsplit(url)
    allowed = {value.lower() for value in allowed_schemes}
    if parsed.scheme.lower() not in allowed or not parsed.hostname:
        raise UnsafeOutboundUrl("Outbound URL must use an approved scheme and host.")
    if parsed.username is not None or parsed.password is not None:
        raise UnsafeOutboundUrl("Outbound URL credentials are not allowed.")
    if parsed.fragment:
        raise UnsafeOutboundUrl("Outbound URL fragments are not allowed.")
    if parsed.hostname.rstrip(".").lower() == "localhost":
        raise UnsafeOutboundUrl("Local destinations are not allowed.")
    try:
        port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    except ValueError as exc:
        raise UnsafeOutboundUrl("Outbound URL port is invalid.") from exc
    try:
        answers = socket.getaddrinfo(parsed.hostname, port, type=socket.SOCK_STREAM)
    except OSError as exc:
        raise UnsafeOutboundUrl("Outbound URL host could not be resolved.") from exc
    addresses = {answer[4][0] for answer in answers}
    if not addresses:
        raise UnsafeOutboundUrl("Outbound URL host did not resolve.")
    for raw_address in addresses:
        try:
            address = ipaddress.ip_address(raw_address)
        except ValueError as exc:
            raise UnsafeOutboundUrl("Outbound URL resolved to an invalid address.") from exc
        if (
            not address.is_global
            or address.is_multicast
            or address.is_loopback
            or address.is_link_local
            or address.is_unspecified
            or address.is_reserved
        ):
            raise UnsafeOutboundUrl("Outbound URL resolved to a non-public address.")
    return url


_PUSH_HOST_SUFFIXES = (
    "fcm.googleapis.com",
    "android.googleapis.com",
    "push.services.mozilla.com",
    "web.push.apple.com",
    "notify.windows.com",
)


def validate_push_endpoint(url: str) -> str:
    validate_outbound_url(url, allowed_schemes={"https"})
    host = (urlsplit(url).hostname or "").rstrip(".").lower()
    if not any(host == suffix or host.endswith(f".{suffix}") for suffix in _PUSH_HOST_SUFFIXES):
        raise UnsafeOutboundUrl("Unsupported browser push service.")
    return url
