import { HttpException, HttpStatus } from '@nestjs/common'

export class StandardError extends HttpException {
  constructor(message: string, errorCode: string, status: HttpStatus) {
    super({ message, errorCode }, status)
  }
}
