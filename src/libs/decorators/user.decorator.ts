import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import configuration from '@/libs/config/configuration'

export const GetUserId = createParamDecorator(
  (_: any, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    const jwt = new JwtService({
      secret: configuration().jwtSecretKey,
    })

    const token = request.headers.authorization?.substr(7)
    if (!token) {
      throw new Error('Authorization token not found')
    }

    const { sub: id }: any = jwt.decode(token) ?? {}
    return id
  }
)
