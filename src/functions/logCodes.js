import * as OTPAuth from "otpauth"

import fs, { readdirSync } from "fs"
import { Jimp } from "jimp"
import { readBarcodes } from "zxing-wasm/reader"

import parser from "otpauth-migration-parser"

import readline from "node:readline"
import { dirname, join, resolve } from "path"
import { fileURLToPath } from "url"
import clipboard from "clipboardy"
import { spawn, execSync } from "node:child_process"
import qrcode from "qrcode-terminal"
import process from "node:process"

const __filename = fileURLToPath(import.meta.url)
let __dirname = dirname(__filename)
__dirname = resolve(__dirname, "../../")

// Almost const/can be changed once, good enough
let MFA_DIR_PATH = join(__dirname, "mfa")
let QR_CODES_DIR_PATH = join(__dirname, "qrcodes")

const GREEN = "\x1b[32m"
const RESET = "\x1b[0m"

function parseObject(object) {
  return {
    issuer: object?.issuer,
    label: object?.name,
    algorithm: object.algorithm,
    digits: object.digits,
    period: 30,
    secret: object.secret,
  }
}


function isWayland() {
  if (process.platform !== "linux") {
    return false
  }

  if (process.env.WAYLAND_DISPLAY) {
    return true
  }

  if (process.env.XDG_SESSION_TYPE === "wayland") {
    return true
  }

  return false
}

function printTable(rows, logNumbers) {
  if (!rows.length) { return }

  const baseHeaders = Object.keys(rows[0])
  const headers = logNumbers ? [
    "#",
    ...baseHeaders,
  ] : baseHeaders

  const preparedRows = logNumbers
    ? rows.map((row, i) => ({
      "#": String(i + 1),
      ...row,
    }))
    : rows

  const widths = headers.map(h =>
    Math.max(
      h.length,
      ...preparedRows.map(r => String(r[h] ?? "").length),
    ))

  const line = (left, mid, right) =>
    GREEN +
    left +
    widths.map(w => "─".repeat(w + 2)).join(mid) +
    right +
    RESET

  const formatRow = (row) =>
    GREEN + "│" + RESET +
    headers
      .map((h, i) => {
        const value = String(row[h] ?? "")
        const padded = " " + value.padEnd(widths[i]) + " "

        if (i === headers.length - 1) {
          return GREEN + padded + RESET
        }

        return padded
      })
      .join(GREEN + "│" + RESET) +
    GREEN + "│" + RESET

  console.log(line("┌", "┬", "┐"))
  console.log(formatRow(Object.fromEntries(headers.map(h => [
    h,
    h,
  ]))))
  console.log(line("├", "┼", "┤"))

  for (const row of preparedRows) {
    console.log(formatRow(row))
  }

  console.log(line("└", "┴", "┘"))
}



function question(q, allowedAnswers = []) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => {

    const ask = (q) => {

      rl.question(q, ans => {

        if(allowedAnswers.length){
          const valid = allowedAnswers.find(a => a.toLowerCase() === ans.toLowerCase())

          if (valid) {
            rl.close()
            resolve(ans)
          } else {
            console.log("Wrong answer, please try again! Allowed answers are:", allowedAnswers)
            ask("")
          }
        }

        else{
          rl.close()
          resolve(ans)
        }
      })
    }

    ask(q)
  })
}

function toOtpAuthUrl(mfa) {
  const label = encodeURIComponent(`${mfa.issuer}:${mfa.name}`)
  const issuer = encodeURIComponent(mfa.issuer)

  return `otpauth://${mfa.type}/${label}?secret=${mfa.secret}&issuer=${issuer}&algorithm=${mfa.algorithm}&digits=${mfa.digits}&period=30`
}


function checkJsonValidity(jsonString) {
  try {
    const data = JSON.parse(jsonString)

    if (!Array.isArray(data)) {return false}

    for (const obj of data) {
      if (typeof obj !== "object" || obj === null) {return false}

      if (!("issuer" in obj) || !("name" in obj) || !("secret" in obj)) {return false}
    }

    return true
  } catch (e) {
    return false
  }
}

async function handleExport(){
  const codes = await getCodesFromJsonFile(true)

  if(codes.codes.length === 0){
    console.log("You do not have any MFA imported, so there is nothing to export eater!")
    process.exit(1)
  }

  console.log("Tip: If you just want to move existing codes to another device for using with this script just copy mfa folder to another device and all you codes will be there.")

  logMfaCode(null, codes.codes, false, true, true)


  const answer = await question("Please enter which codes you want to export (single number or numbers separated by comma \",\", or type \"all\" to export all \n")

  let toExportArray = []

  if(answer === "all"){
    toExportArray = [
      ...codes.codes,
    ]
  }
  else{
    const indexes = answer.split(",")

    indexes.forEach(index => {

      const numeric = Number(index)


      if(Number.isInteger(numeric) && numeric <= codes.codes.length && numeric > 0){
        toExportArray.push(codes.codes[numeric - 1])
      }
      else {
        console.log("skipping ", index)
      }
    })

  }


  const method = await question(
    `
Which method you prefer for exporting? (Enter one of numbers bellow)
1) QR codes (more secure)
2) Show me otpauth:// url and secret directly (Not secure if someone watch your computer)
3) json (Use for exporting to another device, fastest method to import/export using this script.)
`,
    [
      "1",
      "2",
      "3",
    ],
  )


  if(method  === "1"){
    console.log("Bellow are qr codes for export.")
  }
  else if(method === "2"){
    console.log("Bellow are  otpauth:// urls. \n")
  }

  else if(method === "3"){
    const json = JSON.stringify(toExportArray)

    const ask = await question(
      `
Do you want to copy JSON to clipboard (more secure)?
1) Copy
2) Show to console
3) Both
`,
      [
        "1",
        "2",
        "3",
      ],
    )

    if(ask === "2" || ask === "3"){
      console.log(json)
    }

    if(ask === "1" || ask === "3"){
      // TODO - Remove deps by doing check manually without libs On wayland process won't exit for about 5 minutes.
      // clipboardy can't be used. Running spawn manually. Refactor to run spawn for all platforms
      const isRunningOnWayland = isWayland()

      if(isRunningOnWayland){
        spawn("wl-copy", [
          json,
        ], {detached: true})
      }
      else{
        await clipboard.write(json)
      }

      console.log("Copied to clipboard")
    }

    console.log("Bye!")

    process.exit(0)

  }


  toExportArray.forEach(mfa => {
    const url = toOtpAuthUrl(mfa)

    if(method === "1"){
      console.log(`${mfa?.issuer} - ${mfa.name}:`)
      qrcode.generate(url, {small: true})
      console.log("\n")
    }

    else if(method === "2"){
      console.log(`${mfa?.issuer ? mfa.issuer + " - " : ""}${mfa.name} (In case of manual import - secret is ${mfa.secret}) `)
      console.log(url + "\n")
    }
  })

}

async function handleImport(){
  const method = await question(
    `
Please select import method:
1) Paste  otpauth:// or google migration url
2) Enter name, issuer and secret key manually
3) Json import (Fastest, preferred method for coping more codes to multiple devices)
Tip: You can also always add screenshots of your qrcodes in \"qrcodes\" folder (Exported from google or regular mfa QR codes)
`,
    [
      "1",
      "2",
      "3",
    ],
  )

  let final = []

  if(method === "1"){

    const url = await question("Please, paste MFA url: ")

    const parsed = await parseCode(url)
    const current = await getCodesFromJsonFile(true)

    final = [
      ...current.codes,
      parsed,
    ]

  }

  else if (method === "2") {
    const issuer = await question("Issuer:")
    const name = await question("Name (email or label):")
    const secret = await question("Secret (Base32):")

    const parsed = {
      issuer,
      name,
      secret,
      algorithm: "SHA1",
      digits: 6,
      type: "totp",
    }

    const current = await getCodesFromJsonFile(true)

    final = [
      ...current.codes,
      parsed,
    ]

  }

  else if(method === "3"){

    const answer = await question(`
You can either paste json directly or copy it to clipboard and we will try to read it from clipboard. Select method:
1) Read from last clipboard entry (Paste) (More secure / not logged to screen)
2) Paste json directly
`, [
      "1",
      "2",
    ])

    let json

    if(answer === "1"){

      let clipboardEntry

      if(isWayland()){

        try{
          clipboardEntry = execSync("wl-paste", { encoding: "utf8" })

        }
        catch(e){
          console.log("Error in reading from clipboard! Make sure you have correct json / without new lines in clipboard")
          process.exit(1)
        }
      }
      else {
        clipboardEntry = clipboard.writeSync()
      }


      json = clipboardEntry
    }

    else if(answer === "2"){
      json = await question("Paste json to import \n")
    }


    const codes = await getCodesFromJsonFile(true)

    const valid = checkJsonValidity(json)

    if(!valid){
      console.log("Invalid json found in clipboard, exiting!")
      process.exit(1)
    }

    const parsed = JSON.parse(json)

    console.log(parsed.length, Array.isArray(parsed))

    final = [
      ...codes.codes,
      ...parsed,
    ]

  }

  final = await writeJSONVersion(final)

  console.log("Saved new MFA codes!")

  console.log("New mfa full list:")

  logMfaCode(null, final, false, true)

}

export async function choseOperationBasedOnFlags(params) {

  if(params.help) {

    console.log(`
First time usage:
  Screenshot MFA QR codes (from google auth export or regular mfa qr codes) and place screenshots in "qrcodes" folder
  Then run ${GREEN} node index.js ${RESET}

Show all:
  ${GREEN} node index.js ${RESET}

Search specific one:
  ${GREEN} node index.js <name> ${RESET}

Add new tokens:
  You can simply place new screenshots to qrcodes folder and run script with -q flag, or --import
  ${GREEN} node index.js -q ${RESET}
  ${GREEN} node index.js --import ${RESET}

Arguments:
  name      Search MFA entry by name or issuer. If omitted, all entries are shown.
            By default only show first match. You can add   ${GREEN} --multiple  ${RESET} to show all found matches

Options:

  ${GREEN}-c, --copy, --auto-copy${RESET}
      Copy MFA token - if found.

  ${GREEN}-m, --multiple ${RESET}
      Shows all matches - not just first one. Used with name argument!

  ${GREEN}-q, --read-qr-codes${RESET}
      Scan qr codes from qrcodes folder
      Adds new codes and asks before rename/delete.

  ${GREEN}-o, --overwrite${RESET}
      Used with -q
      Force recreating all MFAs without checking for deletion, rename or addition
      (Treats qrcodes folder as single source of truth, possible data lose)

  ${GREEN}-r, --rename${RESET}
      Rename existing MFA entry.

  ${GREEN}-d, --delete${RESET}
      Delete existing MFA entry/entries.

  ${GREEN}-e, --export${RESET}
      Export MFA codes (Supports showing qr code in terminal, otpauth:// URL or json)

  ${GREEN}-i, --import${RESET}
      Import new MFA.
      Supports: otpauth:// URL, Google migration URL or Manual secret entry

  ${GREEN}--restore${RESET}
      If you made some mistake and lost your data, you can restore old version.
      By default full history is saved to prevent data loss.

  ${GREEN} --qrcodes-path ${RESET}
      Use different qrcodes location.
      Strongly recommended to use this alongside --mfa-path to prevent data loss.

  ${GREEN} --mfa-path ${RESET}
      Use different mfa directory location.
      Strongly recommended to use this alongside --qrcodes-path to prevent data loss.

  ${GREEN}-h, --help${RESET}
      Show this help message.

  ${GREEN}-a, --all${RESET}
      Show all saved MFA codes. It's default when name is not specified`)

    process.exit(0)
  }

  if(params.qrCodesFolderPath){
    QR_CODES_DIR_PATH = params.qrCodesFolderPath
  }

  if(params.mfaFolderPath){
    MFA_DIR_PATH = params.mfaFolderPath
  }

  const specialFlags = [
    params.delete,
    params.rename,
    params.import,
    params.export,
    params.restore,
  ]
    .filter(Boolean)

  if (specialFlags.length > 1) {
    throw new Error("Only one operation flag is allowed")
  }

  // Delete and rename operations should have
  // mfa name, but import do not require name.
  if (params.delete) {
    return handleDelete(params.name)
  }

  if (params.rename) {
    return handleRename(params.name)
  }

  if (params.export) {
    return handleExport()
  }

  if (params.import) {
    return handleImport()
  }

  if (params.restore) {
    return handleRestore()
  }

  if (params.readQrCodes) {
    // Should handle "copy and overwrite + log it to console"
    return handleQrCodeRead(params.overwrite)
  }

  // Default case - JSON read -
  // If no json then first json will be created (no need for overwrite)
  await handleDefaultJsonRead(params.name, params.copy, params.showAll, false, params.multiple)
}

function getTimeFromFIle(filename){

  const str = filename.replace(".json", "")

  const d = new Date(str.replace(/-(\d{2})-(\d{2})\./, ":$1:$2."))

  const pad = n => String(n).padStart(2, "0")

  const out =
  `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} at ` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

  return out
}

async function handleQrCodeRead(overwrite){
  const codes = await getCodesFromImages()

  if(codes.codes.length === 0){
    console.log("No MFA found. PLease import some.")
    process.exit(1)
  }
  else{
    await createNewJsonVersion(codes.codes, overwrite)
    console.log("Finished! Full mfa list:")
    await handleDefaultJsonRead(null, false, true, true)

    process.exit(0)
  }
}

async function handleRestore() {
  // Handle cases when there is no mfa folder, or folder is empty
  const dir = MFA_DIR_PATH

  if (!fs.existsSync(dir)) {
    console.log("Folder does not exist:", dir)
  }

  let files = []

  try{
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort((a, b) => a.localeCompare(a))
  }
  catch(e){
    console.error("Error listing files in", dir, "Please check permissions manually", e)
    process.exit(1)
  }

  if (files.length === 0) {
    console.log("No version to restore!")
  }

  if(files.length === 1){
    console.log("There is only one version! nothing to restore.")
  }

  const rows = files.map(f => {
    return {
      "Time": getTimeFromFIle(f),
    }
  })

  printTable(rows, true)

  const ans = await question("Select which version yo want to restore. Enter number bellow \n", files.map((_, index) => String(index + 1)))

  // After this we can be sure there is at least one json file
  const filePath = join(dir, files[ans - 1])
  let codes

  try{
    codes = fs.readFileSync(filePath, "utf8")
  }
  catch(e){
    console.error("Error reading file", filePath, "e", " please check permissions")
    process.exit(1)
  }

  try {
    codes = JSON.parse(codes)
  } catch (e) {
    console.error("Can't parse json in ", filePath, " Please try to fix  manually and try again.", e)
    process.exit(1)
  }

  console.log("here is the preview of version you are restoring to:")
  logMfaCode(null, codes, false, true, false, false)

  const ans2 = await question("Continue? [Y/Yes, N/No]", [
    "Y",
    "Yes",
    "N",
    "No",
  ])

  if([
    "y",
    "yes",
  ].includes(ans2.toLowerCase())){
    const newFileName = new Date().toISOString().replaceAll(":", "-") + ".json"

    try{
      fs.copyFileSync(filePath, join(MFA_DIR_PATH, newFileName ))
      console.log("Restore completed!")
    }
    catch(e){
      console.log("Restore failed! You can restore manaly by coping ", filePath, "to", join(MFA_DIR_PATH, newFileName ) )
    }
  }

  else{
    console.log("Bye")
    process.exit(0)
  }

}

function diffMfa(oldMap, newMap) {
  const added = []
  const removed = []
  const changed = []
  const same = []

  for (const [
    secret,
    newObj,
  ] of newMap) {

    if (!oldMap.has(secret)) {
      added.push(newObj)
    }
    else {
      const oldObj = oldMap.get(secret)

      if (
        oldObj.name !== newObj.name ||
        oldObj.issuer !== newObj.issuer
      ) {
        changed.push({
          secret,
          old: oldObj,
          new: newObj,
        })
      }
      else{
        same.push(oldObj)
      }
    }
  }


  for (const [
    secret,
    oldObj,
  ] of oldMap) {
    if (!newMap.has(secret)) {
      removed.push(oldObj)
    }
  }

  return { added, removed, changed, same }
}


async function handleDefaultJsonRead(name, copy = false, all = false, doNotTryQrs = false, multiple = false) {
  const codes = await getCodesFromJsonFile(doNotTryQrs)

  if(codes.codes.length === 0){
    console.log("No MFA found. PLease import some.")
  }
  else{
    await logMfaCode(name, codes.codes, copy, all, false, multiple)
    process.exit(0)
  }
}

async function createNewJsonVersion(codes, ignoreOldVersions = false) {
  if (ignoreOldVersions) {

    if (codes.length > 0) {
      await writeJSONVersion(codes)
    }
    else{
      console.log("Nothing to write, no codes found")
    }
  }

  else{
    const dir = MFA_DIR_PATH
    fs.mkdirSync(dir, {recursive: true})

    let files

    try {
      files = readdirSync(dir)
        .filter((file) => file.endsWith(".json"))
        .sort((a, b) => b.localeCompare(a))

      // First time running, safe to just create new json version
      if(files.length === 0){
        await writeJSONVersion(codes)
      }

      else{
        try{
          const fileContent = fs.readFileSync(join(dir, files[0]))
          const oldMFAArray = JSON.parse(fileContent)


          const oldMap = new Map(oldMFAArray.map(obj => [
            obj.secret,
            obj,
          ]))
          const newMap = new Map(codes.map(obj => [
            obj.secret,
            obj,
          ]))

          const {added, removed, changed, same} = diffMfa(oldMap, newMap)

          let finalArray = [
            ...same,
          ]

          if(added.length){
            console.log("Added new MFA tokens:")
            logMfaCode(null, added, false, true)


            finalArray = [
              ...finalArray,
              ...added,
            ]

          }

          if(changed.length){
            console.log("Following MFA tokens are changed:")
            logMfaCode(null, changed.map(c => c.old), false, true)
            console.log("with")
            logMfaCode(null, changed.map(c => c.new), false, true)

            const answer = await question(
              `
Do you want to update existing with new ones? Answer with numbers bellow:
1) Yes
2) No
3) Ask me for each
`,
              [
                "1",
                "2",
                "3",
              ],
            )

            if(answer === "1") {
              finalArray = [
                ...finalArray,
                ...changed.map(obj => obj.new),
              ]
            }

            else if(answer === "2"){
              finalArray = [
                ...finalArray,
                ...changed.map(obj => obj.old),
              ]
            }

            else if(answer === "3"){
              const answers = []

              for (const obj of changed) {
                const answer = await question(`Do you want to rename:      ${obj.old.issuer} - ${obj.old.name}      with      ${obj.new.issuer} -  ${obj.new.name} \n [Y/Yes, N/No ]     `, [
                  "Y",
                  "Yes",
                  "N",
                  "No",
                ])


                if([
                  "y",
                  "yes",
                ].includes(answer.toLowerCase())){
                  answers.push(obj.new)
                }


                else if([
                  "n",
                  "no",
                ].includes(answer.toLowerCase())){
                  answers.push(obj.old)
                }

                else{
                  console.log("unknown error, answer must be [Y]es or [N]o!")
                  process.exit(1)
                }
              }

              finalArray = [
                ...finalArray,
                ...answers,
              ]
              console.log("Updated MFA codes:")
              logMfaCode(null, answers, false, true)

            }

            else {
              console.log("unknown error, answer must be 1 2 or 3!")
              process.exit(1)
            }

          }

          if(removed.length){
            console.log("The following MFA codes are missing in new QR code scan.")
            logMfaCode(null, removed, false, true)
            const answer = await question(
              `
Do you want to keep it?
1) Keep all
2) Delete all
3) Ask me for each
`,
              [
                "1",
                "2",
                "3",
              ],
            )


            if(answer === "1"){
              finalArray = [
                ...finalArray,
                ...removed,
              ]
            }

            if(answer === "2"){
              console.log("Following MFAs WILL BE22:32 DELETED")

              logMfaCode(null, removed, false, true)


              const finalAnswer = await question("Are you sure? Type \"save changes\" to continue, any other answer will abort action and keep all MFAs \n")

              if(finalAnswer === "save changes"){
                console.log("Changes are saved!")
              }

              else{
                console.log("Removed MFAs will be kept")

                finalArray = [
                  ...finalArray,
                  ...removed,
                ]
              }

            }

            if(answer === "3"){
              const kept = []
              const deleted = []

              for (const obj of removed) {
                const answer = await question(`Do you want to keep: ${obj.issuer} - ${obj.name}? [Y/Yes, N/No]    `, [
                  "Y",
                  "Yes",
                  "N",
                  "No",
                ])

                if([
                  "y",
                  "yes",
                ].includes(answer.toLowerCase())){
                  kept.push(obj)
                }

                else{
                  deleted.push(obj)
                }

              }

              console.log("Following MFAs WILL BE DELETED")

              logMfaCode(null, deleted, false, true)


              console.log("Following MFAs WILL BE kept")

              logMfaCode(null, kept, false, true)


              const finalAnswer = await question("Are you sure? Type \"save changes\" to continue, any other answer will abort action and keep all MFAs \n")

              if(finalAnswer === "save changes"){

                console.log("Changes are saved!")

                finalArray = [
                  ...finalArray,
                  ...kept,
                ]
              }
              else{
                console.log("Removed MFAs will be kept")

                finalArray = [
                  ...finalArray,
                  ...removed,
                ]
              }
            }

          }

          writeJSONVersion(finalArray)

        }
        catch(error){
          console.log("Error reading old MFA version, aborting", error)
          process.exit(1)
        }
      }
    }
    catch(e){
      console.log("error reading old version", e)
    }
  }
}

async function getCodesFromJsonFile(skipQrBackup) {
  // Handle cases when there is no mfa folder, or folder is empty
  const dir = MFA_DIR_PATH

  let codesResponse = {
    codes: [],
    status: "",
    error: "",
  }

  if (!fs.existsSync(dir)) {
    console.log("Folder does not exist:", dir, "trying to repair it....")

    try {
      fs.mkdirSync(dir)
      console.log("Folder", dir, " Created!")


      if(skipQrBackup){
        codesResponse = {
          codes: [],
          status: "Skipped backup plan",
          error: null,
        }

        return codesResponse
      }

      console.log("Trying to get codes from screenshots....")

      // Skip reading old JSON version and just create new one
      codesResponse = await getCodesFromImages()
      createNewJsonVersion(codesResponse.codes, true)

      return codesResponse

    } catch (e) {
      console.log("Error creating folder:", dir, " Please try crating it manually!", e)
      process.exit(1)
    }
  }


  // After this line we are sure there is MFAS folder
  let files = []

  try{
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort((a, b) => b.localeCompare(a))

  }
  catch(e){
    console.error("Error listing files in", dir, "Please check permissions manually", e)
    process.exit(1)
  }

  if (files.length === 0) {
    console.log("No MFA found!")

    if(skipQrBackup){
      codesResponse = {
        codes: [],
        status: "Skipped backup plan",
        error: null,
      }

      return codesResponse
    }

    console.log("Trying to get codes from screenshots....")

    codesResponse = await getCodesFromImages()
    await createNewJsonVersion(codesResponse.codes, true)

    return codesResponse
  }


  // After this we can be sure there is at least one json file
  const filePath = join(dir, files[0])
  let codes

  try{
    codes = fs.readFileSync(filePath, "utf8")
  }
  catch(e){
    console.error("Error reading file", filePath, "e", " please check permissions")
  }

  try {
    codes = JSON.parse(codes)

    return {
      codes,
      error: null,
      status: true,
    }
  } catch (e) {
    console.error("Can't parse json in ", filePath, " Please try to fix  manually and try again.", e)

    return {
      codes: [],
      error: "wrong-json",
      status: false,
    }
  }
}

async function readQRCode(imagePath) {
  let image

  try {
    image = await Jimp.read(imagePath)
  } catch (e) {
    console.error("Can't read image ", imagePath, " wrong file format of permissions")

    return ""
  }

  const imageData = {
    data: new Uint8ClampedArray(image.bitmap.data),
    width: image.bitmap.width,
    height: image.bitmap.height,
  }


  const result = await readBarcodes(imageData, {
    tryHarder: true,
    formats: [
      "QRCode",
    ],
  })

  if (!result.length) {
    console.error("Image ", imagePath, "has no QR code")

    return ""
  }

  return result[0].text

}


async function writeJSONVersion(newCodes) {
  const grouped = new Map()

  for (const code of newCodes) {
    if (!grouped.has(code.secret)) {
      grouped.set(code.secret, [])
    }

    grouped.get(code.secret).push(code)
  }

  const result = []

  for (const [
    secret,
    codes,
  ] of grouped) {
    if (codes.length === 1) {
      result.push(codes[0])
      continue
    }

    const unique = []

    for (const c of codes) {
      if (!unique.find(u => u.name === c.name && u.issuer === c.issuer)) {
        unique.push(c)
      }
    }

    if (unique.length === 1) {
      result.push(unique[0])
      continue
    }

    const ans = await question(
      "Duplicate found:\n" +
      unique.map((c, i) => `${i + 1}) ${c.issuer} - ${c.name}`).join("\n") +
      `\nWhich one do you want to keep? [1-${unique.length}]\n`,
      unique.map((_, i) => String(i + 1)),
    )

    result.push(unique[Number(ans) - 1])
  }

  const fileName = new Date().toISOString().replaceAll(":", "-") + ".json"
  const folderPath = MFA_DIR_PATH
  const filePath = join(folderPath, fileName)
  const jsonString = JSON.stringify(result, null, 2)

  try {
    fs.mkdirSync(folderPath, { recursive: true })
    fs.writeFileSync(filePath, jsonString)

    return result
  }
  catch (error) {
    console.error(
      "Error writing",
      filePath,
      " cache file! Something went wrong,  please report this!",
      error,
    )
  }
}


async function parseCode(code) {
  if (code.startsWith("otpauth://")) {
    const parsed = OTPAuth.URI.parse(code)

    return {
      issuer: parsed?.issuer,
      name: parsed?.label,
      secret: parsed?.secret.base32,
      algorithm: parsed?.algorithm,
      digits: parsed.digits,
      type: "totp",
    }
  }

  return await parser(code)
}


async function getCodesFromImages() {
  const dir =  QR_CODES_DIR_PATH

  if (!fs.existsSync(dir)) {
    console.log("Folder does not exist:", dir, "trying to repair it....")

    try {
      fs.mkdirSync(dir)

      console.log("Folder qrcodes is created! Place MFA screenshots there, or re-run script with --import")

      // If there is no folder we can know for sure there is no images eater!
      return {
        codes: [],
        status: false,
        error: "no-folder",
      }
    } catch (e) {
      console.log("Error creating folder:", dir, " Please try crating it manually!", e)

      // App wont work without qrcodes folder
      process.exit(1)
    }
  }

  let imageFiles

  try {
    imageFiles = fs.readdirSync(dir)
  } catch (e) {
    console.log("Error listing Images in folder", dir, ", please check permissions")

    // App wont work if folder is unreadable
    process.exit(1)
  }

  imageFiles = imageFiles.map((imageFile) => join(QR_CODES_DIR_PATH, imageFile))

  imageFiles = imageFiles.filter((imageFile) => !imageFile.endsWith(".gitignore"))

  if (!imageFiles.length) {
    console.error("No images found, please add screenshots of qr codes in qrcodes folder, or re-run script with --import flag")

    return {
      codes: [],
      status: false,
      error: "no-images",
    }
  }

  const codes = []

  for (const imagePath of imageFiles) {
    const code = await readQRCode(imagePath)

    if (!code) {continue}

    codes.push(code)
  }

  if (codes.length === 0) {
    console.error("No qr codes found in any image!")

    return {
      codes: [],
      status: false,
      error: "no-qrcodes",
    }
  }

  let parsedCodes = []

  for (const code of codes) {
    try {
      const parsed = await parseCode(code)
      parsedCodes.push(parsed)
    } catch (e) {
      console.log(e)
      console.error(
        "Error parsing ",
        code,
        ". This code will be Skipped! Please delete wrong qr code",
      )
    }
  }

  if (!parsedCodes.length) {
    console.error("All qr codes were invalid!")

    return {
      codes: [],
      status: false,
      error: "all-invalid",
    }
  }

  parsedCodes = parsedCodes.flat()

  return {
    codes: parsedCodes,
    status: true,
    error: null,
  }
}

async function handleDelete(mfaName) {

  if(!mfaName){
    console.log("Please enter name of MFA you want to delete. To see available codes run script with --all flag")
    process.exit(1)
  }

  const codes = await getCodesFromJsonFile(true)

  if(codes.codes.length === 0){
    console.log("You do not have any MFA imported, so there is nothing to delete eater!")
    process.exit(1)
  }

  let newCodes = [
    ...codes.codes,
  ]

  const found = search(codes.codes, mfaName, false)

  if(found.length === 0){
    console.log("Mfa is not found, so it's not deleted. Run script with --all to see all MFAs you saved")
    process.exit(0)
  }

  if(found.length === 1){
    const ans = await question(`Are you sure you want to delete ${found[0]?.issuer} - ${found[0].name}? [Y/Yes, N/No]  \n`, [
      "Y",
      "Yes",
      "N",
      "No",
    ])

    if([
      "y",
      "yes",
    ].includes(ans.toLowerCase())){
      newCodes = newCodes.filter(newCode => newCode.secret !== found[0].secret  )
    }

  }

  else if(found.length > 1){
    console.log("Multiple MFAs found for deletion:")

    logMfaCode(null, found, false, true)

    const answer = await question(
      `
Please select one of options bellow (Insert number and press enter):
1) Delete all found MFA codes
2) Skip all (Do nothing)
3) Ask me for each
`,
      [
        "1",
        "2",
        "3",
      ],
    )

    if(answer === "1") {
      newCodes = newCodes.filter(newCode => !found.some(foundCode => foundCode.secret === newCode.secret))
    }

    else if(answer === "2"){
      console.log("Skipping deletion, bye")
      process.exit(0)
    }

    else if(answer === "3"){
      for(const code of found){

        const ans = await question(`Are you sure you want to delete ${code?.issuer} - ${code.name}? [Y/Yes, N/No]  \n`, [
          "Y",
          "Yes",
          "N",
          "No",
        ])

        if([
          "y",
          "yes",
        ].includes(ans.toLowerCase())){
          newCodes = newCodes.filter(newCode => newCode.secret !== code.secret)
        }
      }
    }

    else {
      console.error("Unknown error!")
      process.exit(1)
    }
  }

  else {
    console.error("Unknown error!")
    process.exit(1)
  }

  await writeJSONVersion(newCodes)

  console.log("Deleted!")
}

function search(codes, mfaName, onlyFirstResult = true){


  if(onlyFirstResult){
    let searchedCode = codes?.find((code) =>
      code.name.toLowerCase().includes(mfaName.toLowerCase()))

    if(!searchedCode){
      searchedCode = codes?.find((code) =>
        code?.issuer.toLowerCase().includes(mfaName.toLowerCase()))
    }

    return searchedCode
  }

  return codes.filter( code => {
    return code.name.toLowerCase().includes(mfaName.toLowerCase()) ||
      code?.issuer?.toLowerCase()?.includes(mfaName.toLowerCase())

  })

}


async function handleRename(mfaName) {

  if(!mfaName){
    console.log("Please enter name of MFA you want to Rename. To see available codes run script with --all flag")
    process.exit(1)
  }

  const codes = await getCodesFromJsonFile(true)

  if(codes.codes.length === 0){
    console.log("You do not have any MFA imported, so there is nothing to rename eater!")
    process.exit(1)
  }

  const found = search(codes.codes, mfaName, false)

  if(found.length === 0){
    console.log("Mfa is not found, nothing to rename. Run script with --all to see all MFAs you saved")
    process.exit(0)
  }

  if(found.length > 0){


    let renamingCode = null


    if(found.length === 1) {
      renamingCode = found[0]
    }

    else if(found.length > 1){
      console.log("Multiple mfa codes are matching the search name:")

      logMfaCode(null, found, false, true, true)
      const ans = await question("please select number which one you want to rename (Enter number): ", found.map((_, index) => String(index + 1)))

      renamingCode = found[ans - 1]

    }

    console.log("Renaming:")

    logMfaCode(null, [
      renamingCode,
    ], false, true)


    const ans = await question(
      `
What you want to change? ${renamingCode?.issuer} - ${renamingCode?.name}? Select number bellow:
1) Change Name
2) Change Issuer
3) Change secret (Advanced)
4) abort
`,
      [
        "1",
        "2",
        "3",
        "4",
      ],
    )

    let newCodes = []

    if(ans === "1"){

      const newName = await question("Enter new mfa name: ")

      newCodes = codes.codes.map(code =>  {
        if(code.secret === renamingCode.secret){
          return {
            ...code,
            name: newName,
          }
        }
        else {
          return code
        }
      })
    }

    else if(ans === "2"){

      const newName = await question("Enter new mfa Issuer: ")

      newCodes = codes.codes.map(code =>  {
        if(code.secret === renamingCode.secret){
          return {
            ...code,
            issuer: newName,
          }
        }
        else {
          return code
        }
      })
    }

    else if(ans === "3"){

      const newName = await question("This option is advanced and can lead to potential data lose. Enter new secret for mfa: ")

      newCodes = codes.codes.map(code =>  {
        if(code.secret === renamingCode.secret){
          return {
            ...code,
            secret: newName,
          }
        }
        else {
          return code
        }
      })

    }

    else if(ans === "4"){
      console.log("Aborted")
      process.exit(0)
    }

    await writeJSONVersion(newCodes)

    console.log("Renamed!")
    process.exit(0)
  }

}

async function logMfaCode(mfaName, codes,  copy = false, all = false, logNumbers = false, multiple = false) {

  const printCodes = (codes) => {
    const result = []
    codes?.forEach((code) => {
      const transformed = parseObject(code)
      const otp = new OTPAuth.TOTP(transformed)
      const token = otp.generate()

      result.push({
        issuer: transformed.issuer,
        name: transformed.label,
        token,
      })
    })

    if (result.length) {
      result.sort( (a, b) => {
        return a.name.localeCompare(b.name)
      })

      printTable(result, logNumbers)

    } else {
      console.log("Nothing to show")
    }
  }



  if (all === true) {
    printCodes(codes)
  }
  else {


    const searchedCode = search(codes, mfaName, !multiple)

    if (!searchedCode) {
      console.warn("Mfa code not found, try running script again with '--all' flag or '--help' for help")
      process.exit(0)
    }

    if(multiple){
      printCodes(searchedCode)
      process.exit(0)
    }

    const transformed = parseObject(searchedCode)
    const otp = new OTPAuth.TOTP(transformed)

    const token = otp.generate()

    if(copy){

      // TODO - Remove deps by doing check manually without libs On wayland process won't exit for about 5 minutes.
      // clipboardy can't be used. Running spawn manually. Refactor to run spawn for all platforms
      const isRunningOnWayland = isWayland()

      if(isRunningOnWayland){
        spawn("wl-copy", [
          token,
        ], {detached: true})
      }
      else{
        await clipboard.write(token)
      }

    }

    console.log(token)
  }
}
