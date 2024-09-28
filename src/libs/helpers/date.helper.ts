export default class DateHelper {
  public static getClosestHourMark(date: Date = new Date()): Date {
    const newDate = new Date(date)
    newDate.setMilliseconds(0)
    newDate.setSeconds(0)
    newDate.setMinutes(0)
    newDate.setHours(newDate.getHours())
    return newDate
  }

  public static formatHour(hourToFormat: number): string {
    const bookingDateHoursString =
      hourToFormat > 24 ? hourToFormat - 24 : hourToFormat

    return `${bookingDateHoursString < 10 ? '0' + bookingDateHoursString : bookingDateHoursString}:00`
  }
}
