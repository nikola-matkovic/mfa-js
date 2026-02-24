import util from "util"

// Wrapper for console log and console error
// Used to stylize logs and to prevent logs in production
/* eslint-disable no-console */
export const colors = {
  RED : "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW : "\x1b[33m",
  BLUE   : "\x1b[38;5;39m",
  RESET :"\x1b[0m",
}

export function logToUserConsole(logType, ...args) {
  const {RED, GREEN, BLUE, YELLOW, RESET} = colors

  const msg = args.map(arg =>
    typeof arg === "string"
      ? arg
      : util.inspect(arg, { depth: null })).join(" ")

  if (logType === "error") {
    console.error(RED + msg + RESET)
  }

  else if (logType === "warn") {
    console.warn(YELLOW + msg + RESET)
  }

  else if (logType === "info") {
    console.log(BLUE + msg + RESET)
  }

  else if (logType === "success") {
    console.log(GREEN + msg + RESET)
  }

  else if (logType === "normal") {
    console.log(msg)
  }

  else {
    console.log(msg)
  }
}