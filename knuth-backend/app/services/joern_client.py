import httpx

from app.config import settings
from app.errors import WarmJoernAnalyzeError, WarmJoernTimeoutError
from app.models import WarmAnalyzeRequest, WarmAnalyzeResponse


class WarmJoernClient:
    def __init__(self, base_url: str | None = None, timeout_seconds: int | None = None) -> None:
        self.base_url = (base_url or settings.warm_joern_url).rstrip('/')
        self.timeout_seconds = timeout_seconds or settings.hard_timeout_seconds

    def analyze(self, request: WarmAnalyzeRequest) -> WarmAnalyzeResponse:
        url = f'{self.base_url}/analyze'
        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.post(url, json=request.model_dump())
                if response.is_error:
                    detail = response.text.strip()
                    raise WarmJoernAnalyzeError(
                        f'Warm Joern analyze failed ({response.status_code}): {detail or "empty response body"}',
                        stderr_tail=detail,
                    )
                return WarmAnalyzeResponse(**response.json())
        except httpx.TimeoutException as exc:
            raise WarmJoernTimeoutError('Warm Joern request timed out.') from exc
        except httpx.HTTPError as exc:
            raise WarmJoernAnalyzeError(f'Warm Joern request failed: {exc}') from exc
