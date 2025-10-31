"use strict";

const fs = require("fs");
const path = require("path");
const { runAll } = require("./harness");

function listTestFiles(dir) {
  const out = [];
  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /\.test\.js$/.test(e.name)) out.push(p);
    }
  }
  walk(dir);
  return out;
}

const testsDir = path.join(__dirname);
const files = listTestFiles(testsDir).filter(p => !p.endsWith(path.sep + "run.test.js"));
const loaded = files.map((f) => require(f));

runAll(loaded).catch((err) => {
  console.error(err);
  process.exit(1);
});

