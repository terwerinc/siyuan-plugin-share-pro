/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2022 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 *
 */

const getRegisterInfo = (payType: string): string => {
  let registerInfo: string

  switch (payType) {
    case "day":
      registerInfo = "日卡"
      break
    case "week":
      registerInfo = "周卡"
      break
    case "month":
      registerInfo = "月卡"
      break
    case "quarter":
      registerInfo = "季卡"
      break
    case "year":
      registerInfo = "年卡"
      break
    default:
      registerInfo = "默认日卡"
      break
  }

  return registerInfo
}

export { getRegisterInfo }
