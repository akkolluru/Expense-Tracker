from fastapi import HTTPException, status


class AppException(HTTPException):
    def __init__(self, status_code: int, detail: str, error_code: str):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code

class NotFoundError(AppException):
    def __init__(self, resource: str, id: str | int):
        super().__init__(status.HTTP_404_NOT_FOUND, f"{resource} with id '{id}' not found", "NOT_FOUND")

class DuplicateError(AppException):
    def __init__(self, resource: str, field: str, value: str):
        super().__init__(status.HTTP_409_CONFLICT, f"{resource} with {field} '{value}' already exists", "DUPLICATE")

class AuthenticationError(AppException):
    def __init__(self, detail: str = "Invalid credentials"):
        super().__init__(status.HTTP_401_UNAUTHORIZED, detail, "AUTH_FAILED")

class ValidationError(AppException):
    def __init__(self, detail: str):
        super().__init__(status.HTTP_422_UNPROCESSABLE_ENTITY, detail, "VALIDATION_ERROR")
