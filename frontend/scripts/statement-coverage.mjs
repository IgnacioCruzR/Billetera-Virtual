import { spawnSync } from 'node:child_process'
import console from 'node:console'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import istanbul from 'istanbul-lib-instrument'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const tests = readdirSync(join(root, 'tests')).filter(file => file.endsWith('.unit.ts'))
const unitArgs = ['--experimental-strip-types', '--test', 'tests/*.unit.ts']

function run(args, cwd) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr + result.stdout)
  return result.stdout
}

const lcov = run(['--experimental-test-coverage', '--test-coverage-include=src/**', '--test-reporter=lcov', ...unitArgs], root)
const sources = [...lcov.matchAll(/^SF:(.+)$/gm)].map(([, file]) => relative(root, resolve(root, file)).split(sep).join('/'))
if (!sources.length || sources.some(file => !file.startsWith('src/'))) throw new Error('LCOV sin fuentes válidas en src/')

const parent = resolve(tmpdir())
const directory = mkdtempSync(join(parent, 'billetera-statements-'))
try {
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction')
  writeFileSync(join(directory, 'package.json'), '{"type":"module"}')
  const statements = new Map()
  const instrumenter = istanbul.createInstrumenter({ esModules: true })
  for (const file of sources) {
    const source = readFileSync(join(root, file), 'utf8')
    const { outputText } = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true },
    })
    const target = join(directory, file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, instrumenter.instrumentSync(outputText, file))
    statements.set(file, { ...instrumenter.lastFileCoverage().s })
  }

  mkdirSync(join(directory, 'tests'))
  for (const file of tests) {
    const source = readFileSync(join(root, 'tests', file), 'utf8')
    writeFileSync(join(directory, 'tests', file), `${source}
import { writeFileSync as writeStatementCounts } from 'node:fs'
import { after as collectStatements } from 'node:test'
collectStatements(() => writeStatementCounts(new URL('./${file}.json', import.meta.url), JSON.stringify(globalThis.__coverage__ ?? {})))
`)
  }

  run(unitArgs, directory)
  for (const test of tests) {
    const coverage = JSON.parse(readFileSync(join(directory, 'tests', `${test}.json`), 'utf8'))
    for (const [file, { s }] of Object.entries(coverage)) {
      const counts = statements.get(file)
      for (const [id, count] of Object.entries(s)) counts[id] += count
    }
  }

  const totals = [...statements.values()].flatMap(Object.values)
  const covered = totals.filter(Boolean).length
  console.log(`Sentencias: ${(100 * covered / totals.length).toFixed(2)}% (${covered}/${totals.length}) en ${sources.length} archivos`)
  for (const [file, counts] of statements) {
    const values = Object.values(counts)
    console.log(`${file}: ${values.filter(Boolean).length}/${values.length}`)
  }
} finally {
  if (dirname(directory) === parent && basename(directory).startsWith('billetera-statements-')) {
    rmSync(directory, { recursive: true, force: true })
  }
}
