import { execa } from "execa"

const command = "wl-copy"
const arguments_ = [ "--type",
  "text/plain" ]
const options =  { input: "221226" }


const result = await execa(command, arguments_, options)

console.log(result)