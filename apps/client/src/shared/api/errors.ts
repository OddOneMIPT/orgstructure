/** Сервер ответил, но не тем, чем нужно. */
export class HttpError extends Error {
  override readonly name = 'HttpError';

  constructor(readonly status: number) {
    super(`Сервер ответил ошибкой ${status}`);
  }
}

/** Ответ не прошёл схему контракта — по заданию это ошибка, а не повод «как-нибудь отрисовать». */
export class ValidationError extends Error {
  override readonly name = 'ValidationError';

  constructor(readonly issues: readonly string[] = []) {
    const sample = issues.slice(0, 3).join('; ');
    super(`Ответ не соответствует схеме${sample ? `: ${sample}` : ''}`);
  }
}

/** Сеть недоступна: оффлайн, обрыв, CORS. */
export class NetworkError extends Error {
  override readonly name = 'NetworkError';

  constructor(override readonly cause?: unknown) {
    super('Не удалось связаться с сервером');
  }
}
