import {
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common'
import { ErrorMessage, ErrorCode } from '@/libs/errors/error-codes'
import { StandardError } from '@/libs/errors/standard-error'
import { PrismaService } from '@/prisma/prisma.service'
import { BaseUserModel } from '@/modules/api/users/users.interface'


@Injectable()
export class UsersService {
  private logger = new Logger(UsersService.name)

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findUserById(
    id: string,
    customer: boolean = false
  ): Promise<BaseUserModel | undefined> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: id,
      },
      include: {
        customer: customer
          ? { include: { institution: { select: { name: true } } } }
          : false,
      },
    })

    if (!user) {
      throw new StandardError(
        ErrorMessage[ErrorCode.USER_NOT_FOUND],
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND
      )
    }

    return user
  }
}
