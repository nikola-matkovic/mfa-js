import { getCodes } from "./getCodes.js"
import {parseObject} from "./parseObject.js"
import * as OTPAuth from "otpauth"

export async function getSingleToken(code) {

  const transformed = parseObject(code)
  const otp = new OTPAuth.TOTP(transformed)

  const token = otp.generate()

  return token
}


export async function getAllTokens() {
  const res = await getCodes(false)

  return res
}

