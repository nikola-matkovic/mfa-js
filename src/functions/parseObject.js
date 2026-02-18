export function parseObject(object) {
  return {
    issuer: object?.issuer,
    label: object?.name,
    algorithm: object.algorithm,
    digits: object.digits,
    period: 30,
    secret: object.secret,
  }
}