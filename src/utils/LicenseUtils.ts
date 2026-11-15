/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2022-2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
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
    case "trial":
      registerInfo = pluginInstance.i18n.serviceAccess.trialPlan
      break
    case "lifetime":
    case "permanent":
      registerInfo = pluginInstance.i18n.keyInfo.lifetime
      break
    default:
      registerInfo = payType || pluginInstance.i18n.serviceAccess.unknownPlan
      break
  }

  return registerInfo
}

export { getRegisterInfo }
