import { choseOperationBasedOnFlags } from "./functions/logCodes.js"

export default function handleArgs() {
  const args = process.argv.slice(2)

  const flags = {
    copy: args.includes("--auto-copy") || args.includes("-c") || args.includes("--copy"),
    readQrCodes: args.includes("--read-qr-codes") || args.includes("-q"),
    delete: args.includes("--delete") || args.includes("-d"),
    overwrite: args.includes("--overwrite") || args.includes("-o"),
    rename: args.includes("--rename") || args.includes("-r"),
    export: args.includes("--export") || args.includes("-e"),
    import: args.includes("--import") || args.includes("-i"),
    showAll: args.includes("--all") || args.includes("-a"),
    multiple: args.includes("--multiple") || args.includes("-m"),
    help: args.includes("--help") || args.includes("-h"),
  }

  let qrCodesFolderPath = null
  let mfaFolderPath = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--qrcodes-path") {
      qrCodesFolderPath = args[i + 1]
      i++
      continue
    }

    if (args[i] === "--mfa-path") {
      mfaFolderPath = args[i + 1]
      i++
      continue
    }
  }

  const usedValues = [
    qrCodesFolderPath,
    mfaFolderPath,
  ].filter(Boolean)
  const nameArg = args.find(a => !a.startsWith("-") && !usedValues.includes(a))
  const name = nameArg ?? null

  if (!name) {
    flags.showAll = true
  }

  const params = {
    ...flags,
    name,
    qrCodesFolderPath,
    mfaFolderPath,
  }

  choseOperationBasedOnFlags(params)
}