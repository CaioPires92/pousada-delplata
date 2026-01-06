import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

let prisma
if (process.env.DATABASE_AUTH_TOKEN) {
    const libsql = createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN })
    const adapter = new PrismaLibSQL(libsql)
    prisma = new PrismaClient({ adapter })
} else {
    const dbUrl = process.env.DATABASE_URL || 'file:./dev.db'
    prisma = new PrismaClient({
        datasources: {
            db: { url: dbUrl }
        }
    })
}
const publicRoot = path.join(process.cwd(), 'public')
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function norm(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function folderForRoom(name) {
    const n = norm(name)
    if (n.includes('chale')) return 'fotos/ala-chales/chales'
    if (n.includes('anexo')) return 'fotos/ala-chales/apartamentos-anexo'
    if (n.includes('superior')) return 'fotos/ala-principal/apartamentos/superior'
    if (n.includes('terreo') || n.includes('térreo')) {
        if (n.includes('sem janela') || n.includes('sem janelas')) return 'fotos/ala-principal/apartamentos/terreo/sem-janelas'
        if (n.includes('com janela') || n.includes('com janelas')) return 'fotos/ala-principal/apartamentos/terreo/com-janelas'
        return 'fotos/ala-principal/apartamentos/terreo'
    }
    if (n.includes('apartamento') && n.includes('superior')) return 'fotos/ala-principal/apartamentos/superior'
    if (n.includes('apartamento') && (n.includes('terreo') || n.includes('térreo'))) return 'fotos/ala-principal/apartamentos/terreo'
    return null
}

async function listFiles(dir) {
    if (!fs.existsSync(dir)) return []
    const files = await fs.promises.readdir(dir)
    return files.filter(f => exts.has(path.extname(f).toLowerCase()))
}

function pickOrder(files) {
    const pref = files.filter(f => /-1200\.webp$/i.test(f)).sort()
    if (pref.length) return pref
    return files.sort()
}

async function main() {
    const rooms = await prisma.roomType.findMany({ include: { photos: true } })
    for (const room of rooms) {
        const folderRelBase = folderForRoom(room.name)
        if (!folderRelBase) continue
        const candidates = [
            folderRelBase,
            folderRelBase.includes('terreo') ? folderRelBase + '/com-janela' : null,
            folderRelBase.includes('terreo') ? folderRelBase + '/com-janelas' : null,
            folderRelBase.includes('terreo') ? folderRelBase + '/sem-janela' : null,
            folderRelBase.includes('terreo') ? folderRelBase + '/sem-janelas' : null,
        ].filter(Boolean)
        let files = []
        for (const rel of candidates) {
            const abs = path.join(publicRoot, rel)
            const f = await listFiles(abs)
            files.push(...f.map(x => ({ rel, file: x })))
        }
        const ordered = pickOrder(files.map(x => x.file))
        if (!ordered.length) continue
        for (let i = 0; i < room.photos.length && i < ordered.length; i++) {
            const file = ordered[i]
            const entry = files.find(x => x.file === file) || { rel: folderRelBase }
            const url = `/${entry.rel}/${file}`.replace(/\\/g, '/')
            await prisma.photo.update({ where: { id: room.photos[i].id }, data: { url } })
            process.stdout.write(`Photo ${room.photos[i].id} (${room.name}) -> ${url}\n`)
        }
    }
    await prisma.$disconnect()
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
