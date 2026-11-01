export class AdminRequestError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 413 | 415) {
    super(message)
    this.name = 'AdminRequestError'
  }
}
