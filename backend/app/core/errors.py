class DomainError(ValueError):
    """Expected business-rule violation that is safe to return to clients."""


class NotFoundError(DomainError):
    pass


class ForbiddenError(DomainError):
    pass


class ConflictError(DomainError):
    pass


class ServiceUnavailableError(DomainError):
    pass
