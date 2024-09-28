import { AccountType } from '@prisma/client'
import { StandardError } from '@/libs/errors/standard-error'
import { ErrorCode, ErrorMessage } from '@/libs/errors/error-codes'
import { HttpStatus } from '@nestjs/common'

export default class Utils {
  // removes unwanted props from obj
  // keys are props to be removed
  public static onlyInclude(obj, keys) {
    return Object.fromEntries(
      Object.entries(obj).filter(([key]) => keys.includes(key))
    )
  }

  public static checkUserAuthorization(currentUser, user) {
    if (
      currentUser.accountType !== AccountType.Admin &&
      currentUser.institutionMember.institutionId !==
        user.customer.institutionId
    ) {
      throw new StandardError(
        ErrorMessage[ErrorCode.UNAUTHORIZED],
        ErrorCode.UNAUTHORIZED,
        HttpStatus.FORBIDDEN
      )
    }
  }
}
