export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_FOUND = 'NOT_FOUND',

  PERMISSION_DENIED = 'PERMISSION_DENIED',

  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_LOGIN_DETAILS = 'INVALID_LOGIN_DETAILS',
  USER_NOT_ACTIVE = 'USER_NOT_ACTIVE',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INCORRECT_PASSWORD = 'INCORRECT_PASSWORD',
  INVALID_ACCOUNT_TYPE = 'INVALID_ACCOUNT_TYPE',
  INVALID_ACCOUNT_CREATION = 'INVALID_ACCOUNT_CREATION',
  INVALID_ACCOUNT_CREATION_ADMIN_ONLY = 'INVALID_ACCOUNT_CREATION_ADMIN_ONLY',
  PASSWORDS_DO_NOT_MATCH = 'PASSWORDS_DO_NOT_MATCH',

  EMAIL_ALREADY_EXIST = 'EMAIL_ALREADY_EXIST',
  MOBILE_NUMBER_ALREADY_EXIST = 'MOBILE_NUMBER_ALREADY_EXIST',
  NAME_ALREADY_EXIST = 'NAME ALREADY EXIST',
  COC_NUMBER_ALREADY_EXIST = 'COC_NUMBER_ALREADY_EXIST',

  SOMETHING_UNIQUE_ALREADY_EXIST = 'SOMETHING_UNIQUE_ALREADY_EXIST',

  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  INTERNAL_SERVER_ERROR = 'INTERNAL_ERROR',

  NO_AVAILABLE_SCOOTER = 'NO_AVAILABLE_SCOOTER',
  INVALID_BOOKING_TIME = 'INVALID_BOOKING_TIME',
  INACTIVE_USER = 'INACTIVE_USER',
  DUPLICATE_BOOKING = 'DUPLICATE_BOOKING',
  INVALID_BOOKING_REQUEST = 'INVALID_BOOKING_REQUEST',
  UPDATE_BOOKING_SCOOTER_CONFLICT = 'UPDATE_BOOKING_SCOOTER_CONFLICT',
  BOOKING_NOT_FOUND = 'BOOKING_NOT_FOUND',

  INSTITUTION_ALREADY_EXIST = 'INSTITUTION_ALREADY_EXIST',
  INSTITUTION_NOT_FOUND = 'INSTITUTION_NOT_FOUND',

  SCOOTER_POOL_ALREADY_EXISTS = 'SCOOTER_POOL_ALREADY_EXISTS',
  SCOOTER_POOL_NOT_FOUND = 'SCOOTER_POOL_NOT_FOUND',
  SCOOTER_ALREADY_EXISTS = 'SCOOTER_ALREADY_EXISTS',
  SCOOTER_NOT_FOUND = 'SCOOTER_NOT_FOUND',
}

export const ErrorMessage = {
  [ErrorCode.INVALID_INPUT]: 'Invalid input provided.',
  [ErrorCode.INVALID_LOGIN_DETAILS]: 'Invalid login details provided.',
  [ErrorCode.NOT_FOUND]: 'Resource not found.',
  [ErrorCode.PERMISSION_DENIED]: 'Permission denied.',
  [ErrorCode.UNAUTHORIZED]: 'Unauthorized access.',
  [ErrorCode.USER_NOT_ACTIVE]:
    'User account is currently inactive. Please contact support for assistance.',
  [ErrorCode.INCORRECT_PASSWORD]: 'Unauthorized: Incorrect current password',
  [ErrorCode.USER_NOT_FOUND]: 'User not found.',
  [ErrorCode.TOKEN_INVALID]: 'Invalid token provided.',
  [ErrorCode.TOKEN_EXPIRED]: 'Token has expired.',
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Internal server error.',
  [ErrorCode.NO_AVAILABLE_SCOOTER]: 'No available scooter.',
  [ErrorCode.INVALID_BOOKING_TIME]: 'Booking should be between 8:00 and 20:00.',
  [ErrorCode.INACTIVE_USER]:
    'User is inactive. Please contact administrator for assistance.',
  [ErrorCode.DUPLICATE_BOOKING]: 'Duplicate booking found.',
  [ErrorCode.INVALID_BOOKING_REQUEST]:
    'Invalid booking request. Please contact support for assistance.',
  [ErrorCode.BOOKING_NOT_FOUND]: 'Booking not found.',
  [ErrorCode.INVALID_ACCOUNT_TYPE]:
    'Invalid account type. Please contact administrator for assistance.',
  [ErrorCode.INVALID_ACCOUNT_CREATION]:
    'Invalid account creation. Please contact administrator for assistance.',
  [ErrorCode.INVALID_ACCOUNT_CREATION_ADMIN_ONLY]:
    'Institution members can only create User type accounts.',
  [ErrorCode.UPDATE_BOOKING_SCOOTER_CONFLICT]:
    'Unable to update booking scooter is already reserved within the new timeslot.',
  [ErrorCode.SOMETHING_UNIQUE_ALREADY_EXIST]:
    'Something already exists with the same unique identifier.',
  [ErrorCode.INSTITUTION_ALREADY_EXIST]:
    'Institution already exists. Please contact administrator for assistance.',
  [ErrorCode.INSTITUTION_NOT_FOUND]: 'Institution not found.',
  [ErrorCode.EMAIL_ALREADY_EXIST]: 'Email already exists.',
  [ErrorCode.MOBILE_NUMBER_ALREADY_EXIST]: 'Mobile number already exists.',
  [ErrorCode.NAME_ALREADY_EXIST]: 'Name already exists',
  [ErrorCode.SCOOTER_POOL_ALREADY_EXISTS]: 'Scooter pool already exists.',
  [ErrorCode.SCOOTER_POOL_NOT_FOUND]: 'Scooter pool not found.',
  [ErrorCode.SCOOTER_ALREADY_EXISTS]: 'Scooter already exists.',
  [ErrorCode.SCOOTER_NOT_FOUND]: 'Scooter not found.',
}
