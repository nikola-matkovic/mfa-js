const { spawnSync } = require("child_process")
const { resolve } = require("path")

const cmd =
  "node --no-warnings " +
  resolve(
    __dirname,
    "./src/cli.js " + process.argv.filter((e, i) => i > 1).join(" "),
  )

spawnSync(cmd, { stdio: "inherit", shell: true })
