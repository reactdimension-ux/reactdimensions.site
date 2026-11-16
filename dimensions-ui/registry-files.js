import { fork } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

// Serves (in dev) and writes (on build) two kinds of machine-readable files
// generated from src/library/registry.jsx, so they never drift from the site:
//
//   /r/<slug>.json  a shadcn registry item per component: its exact source and
//                   npm dependencies. Installable with
//                   `npx shadcn@latest add <site>/r/<slug>.json`, and what the
//                   "Open in ChatGPT / Claude" prompts point the assistant at.
//   /llms.txt       an index of every component, with docs and JSON links.
//
// Files keep their path relative to src/ under components/react-dimensions/,
// so the relative imports between a component's files still resolve.

const REGISTRY = '/src/library/registry.jsx'
const BASE = 'components/react-dimensions'

function locate(root, file) {
  if (file.includes('/')) return file
  return fs.existsSync(path.join(root, 'src/lib', file)) ? `lib/${file}` : file
}

function itemFor(root, reg, c) {
  return {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name: c.slug,
    type: 'registry:component',
    title: c.name,
    description: c.description,
    categories: [c.category, c.style].filter(Boolean),
    dependencies: c.deps,
    files: reg.sourceFor(c).map((f) => {
      const rel = locate(root, f.file)
      return { path: `react-dimensions/${rel}`, type: 'registry:component', target: `${BASE}/${rel}`, content: f.code }
    }),
  }
}

function llms(reg) {
  const sections = reg.CATEGORIES.map((cat) => {
    const items = reg.COMPONENTS.filter((c) => c.category === cat)
    if (!items.length) return ''
    const lines = items.map((c) => `- [${c.name}](/library/${c.slug}): ${c.description} Source and dependencies: [/r/${c.slug}.json](/r/${c.slug}.json)`)
    return `## ${cat}\n\n${lines.join('\n')}`
  })
  return `# React Dimensions

> A library of interactive, animated and 3D React components. Every component has a docs page with live controls, and a JSON registry item with its exact source and npm dependencies, installable with \`npx shadcn@latest add <site>/r/<slug>.json\`. Components are JavaScript (JSX) with inline styles; there are no CSS files to import.

${sections.filter(Boolean).join('\n\n')}
`
}

async function generate(root, load) {
  const reg = await load(REGISTRY)
  const out = { 'llms.txt': llms(reg) }
  for (const c of reg.COMPONENTS) {
    // sources load on demand in the registry; fetch them before reading
    await reg.loadSources(c)
    out[`r/${c.slug}.json`] = JSON.stringify(itemFor(root, reg, c), null, 2)
  }
  return out
}

export default function registryFiles() {
  let root
  let outDir
  return {
    name: 'rd-registry-files',
    configResolved(config) {
      root = config.root
      outDir = path.resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (url !== '/llms.txt' && !/^\/r\/[\w-]+\.json$/.test(url)) return next()
        try {
          const files = await generate(root, (id) => server.ssrLoadModule(id))
          const body = files[url.slice(1)]
          if (!body) return next()
          res.setHeader('Content-Type', url.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(body)
        } catch (err) {
          next(err)
        }
      })
    },
    async closeBundle() {
      // Loading the registry pulls in every component module, and some leave
      // handles open, so it runs in a child process that exits when done
      // rather than holding the build open.
      const code = await new Promise((resolve) => {
        const child = fork(fileURLToPath(import.meta.url), [root, outDir], { env: { ...process.env, RD_REGISTRY_CHILD: '1' }, stdio: 'inherit' })
        child.on('exit', resolve)
      })
      if (code !== 0) this.error(`registry files: generator exited with code ${code}`)
    },
  }
}

// child process: load the registry through a throwaway Vite server (so JSX and
// import.meta.glob resolve exactly as in the app), write the files, exit
async function writeAll(root, outDir) {
  const server = await createServer({
    root,
    // no config file: loading vite.config.js here would load this plugin again
    configFile: false,
    plugins: [react()],
    // its own cache: sharing node_modules/.vite would rewrite the running dev
    // server's pre-bundled deps and load React twice in the browser
    cacheDir: path.join(root, 'node_modules/.vite-registry-files'),
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  const files = await generate(root, (id) => server.ssrLoadModule(id))
  for (const [name, body] of Object.entries(files)) {
    const file = path.join(outDir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, body)
  }
  console.log(`rd-registry-files: wrote ${Object.keys(files).length} files (/r/*.json, /llms.txt)`)
}

// run only as the forked entry script, never when imported by vite.config.js
if (process.env.RD_REGISTRY_CHILD && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeAll(process.argv[2], process.argv[3]).then(
    () => process.exit(0),
    (err) => { console.error(err); process.exit(1) },
  )
}
