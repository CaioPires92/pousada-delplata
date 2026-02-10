import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const root = path.join(process.cwd(), 'public', 'fotos')
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const sizes = [480, 768, 1200, 1920]

async function* walk(dir) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) yield* walk(p)
        else yield p
    }
}

async function optimizeOne(file) {
    const ext = path.extname(file).toLowerCase()
    if (!exts.has(ext)) return
    const base = path.basename(file, ext)
    const dir = path.dirname(file)
    const buf = await fs.promises.readFile(file)
    for (const w of sizes) {
        const out = path.join(dir, `${base}-${w}.webp`)
        if (fs.existsSync(out)) continue
        const img = sharp(buf).rotate()
        const meta = await img.metadata()
        const h = meta.width ? Math.round((w / meta.width) * (meta.height || w)) : w
        const outBuf = await img.resize(w, h, { fit: 'inside' }).webp({ quality: 80 }).toBuffer()
        await fs.promises.writeFile(out, outBuf)
        process.stdout.write(`+ ${out}\n`)
    }
}

async function main() {
    if (!fs.existsSync(root)) {
        console.log('No fotos directory found at', root)
        return
    }
    for await (const file of walk(root)) {
        await optimizeOne(file)
    }
    console.log('Done.')
}

main()
