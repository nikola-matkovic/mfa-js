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
    help: args.includes("--help") || args.includes("-h"),
  }

  const nameArg = args.find((a) => !a.startsWith("-"))
  const name = nameArg ?? null

  if(!name) {flags.showAll = true}

  const params = {
    ...flags,
    name,
  }

  choseOperationBasedOnFlags(params)
}
