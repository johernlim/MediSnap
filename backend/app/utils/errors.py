class ProcessingError(Exception):
    """A safe client message plus an HTTP code; never include credentials."""
    def __init__(self, message: str, status: str = 'PROCESSING_ERROR', code: int = 503):
        super().__init__(message)
        self.message, self.status, self.code = message, status, code
