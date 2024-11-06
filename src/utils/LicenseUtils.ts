/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2022 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 *
 */

import ShareProPlugin from "../index"

const getRegisterInfo = (pluginInstance: ShareProPlugin, payType: string): string => {
  let registerInfo: string

  switch (payType) {
    case "day":
      registerInfo = pluginInstance.i18n.cardType.day
      break
    case "week":
      registerInfo = pluginInstance.i18n.cardType.week
      break
    case "month":
      registerInfo = pluginInstance.i18n.cardType.month
      break
    case "quarter":
      registerInfo = pluginInstance.i18n.cardType.quarter
      break
    case "year":
      registerInfo = pluginInstance.i18n.cardType.year
      break
    default:
      registerInfo = pluginInstance.i18n.cardType.day
      break
  }

  return registerInfo
}

export { getRegisterInfo }
