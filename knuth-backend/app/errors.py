class JobProcessingError(Exception):
    code = 'INTERNAL_ERROR'

    def __init__(self, message: str = '', stderr_tail: str = '') -> None:
        super().__init__(message)
        self.stderr_tail = stderr_tail


class WarmJoernError(JobProcessingError):
    code = 'JOERN_FAILED'


class WarmJoernTimeoutError(WarmJoernError):
    code = 'TIMEOUT'


class WarmJoernAnalyzeError(WarmJoernError):
    pass


class CfgParsingError(JobProcessingError):
    code = 'INTERNAL_ERROR'
