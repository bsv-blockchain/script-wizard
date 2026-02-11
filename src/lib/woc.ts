import { MerklePath, Transaction } from '@bsv/sdk'

interface RequestOptions {
    method: string
    headers: Record<string, string>
    body?: string
}

interface QueueItem {
    resolve: (value: unknown) => void
    reject: (reason?: unknown) => void
    request: {
        url: string
        options: RequestOptions
    }
}

interface WocUtxoRaw {
    tx_hash: string
    tx_pos: number
    value: number
}

interface WocUtxoFormatted {
    txid: string
    vout: number
    satoshis: number
    script: string
}

interface WocUnspentResponse {
    result?: WocUtxoRaw[]
    script?: string
    results?: unknown[]
}

interface TSCProof {
    txOrId: string
    target: string
    index: number
    nodes: string[]
}

interface BlockHeader {
    height: number
    merkleroot: string
}

interface MerkleLeaf {
    hash?: string
    txid?: boolean
    offset: number
    duplicate?: boolean
}

// https://api.whatsonchain.com/v1/bsv/main/exchangerate
/**
 *  WocClient
 * @class
 * @classdesc A class for interacting with the Whatsonchain API
 * @example
 * const woc = new WocClient()
 * const utxos = await woc.getUtxos('1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu')
 */
export class WocClient {
    private api: string
    private requestQueue: QueueItem[] = []
    private isProcessingQueue: boolean = false

    constructor() {
        this.api = 'https://api.whatsonchain.com/v1/bsv/main'
    }

    setNetwork(network: string): void {
        this.api = `https://api.whatsonchain.com/v1/bsv/${network}`
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue) return
        this.isProcessingQueue = true
        while (this.requestQueue.length > 0) {
            const { resolve, request } = this.requestQueue.shift()!
            try {
                const response = await fetch(request.url, request.options)
                if (request.options.headers.Accept === 'plain/text') {
                    const text = await response.text()
                    resolve(text)
                } else {
                    const data = await response.json()
                    resolve(data)
                }
            } catch (error) {
                console.log({ error })
                resolve(null)
            }
            await new Promise<void>(resolve => setTimeout(resolve, 350))
        }
        this.isProcessingQueue = false
    }

    private queueRequest(url: string, options: RequestOptions): Promise<unknown> {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ resolve, reject, request: { url, options } })
            this.processQueue()
        })
    }

    private async getJson<T = unknown>(route: string): Promise<T> {
        return await this.queueRequest(this.api + route, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        }) as T
    }

    private async get(route: string): Promise<string> {
        return await this.queueRequest(this.api + route, {
            method: 'GET',
            headers: {
                'Accept': 'plain/text',
            },
        }) as string
    }

    async post<T = unknown>(route: string, body: unknown): Promise<T> {
        return await this.queueRequest(this.api + route, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(body)
        }) as T
    }

    async getUtxos(address: string): Promise<WocUtxoFormatted[]> {
        console.log({ getUtxo: address })
        let confirmed: WocUnspentResponse = { results: [] }
        let unconfirmed: WocUnspentResponse = { results: [] }
        try {
            confirmed = await this.getJson<WocUnspentResponse>(`/address/${address}/confirmed/unspent`)
        } catch (error) {
            console.log({ error })
        }
        try {
            unconfirmed = await this.getJson<WocUnspentResponse>(`/address/${address}/unconfirmed/unspent`)
        } catch (error) {
            console.log({ error })
        }
        const combined: WocUtxoRaw[] = []
        confirmed?.result?.map(utxo => combined.push(utxo))
        unconfirmed?.result?.map(utxo => combined.push(utxo))
        const script = confirmed?.script || unconfirmed?.script || ''
        const formatted = combined.map(u => ({ txid: u.tx_hash, vout: u.tx_pos, satoshis: u.value, script }))
        console.log({ confirmed, unconfirmed, combined, formatted })
        return formatted
    }

    async getTx(txid: string): Promise<string> {
        return this.get(`/tx/${txid}/hex`)
    }

    async getBeef(txid: string): Promise<string> {
        return this.get(`/tx/${txid}/beef`)
    }

    async getMerklePath(txid: string): Promise<TSCProof | TSCProof[] | null> {
        return this.getJson<TSCProof | TSCProof[] | null>(`/tx/${txid}/proof/tsc`)
    }

    async getHeader(hash: string): Promise<BlockHeader> {
        return this.getJson<BlockHeader>(`/block/${hash}/header`)
    }

    async convertTSCtoBUMP(tsc: TSCProof): Promise<MerklePath> {
        const txid = tsc.txOrId
        const header = await this.getHeader(tsc.target)
        const blockHeight = header.height
        const path: MerkleLeaf[][] = []
        const leafOfInterest: MerkleLeaf = { hash: txid, txid: true, offset: tsc.index }
        tsc.nodes.map((hash: string, idx: number) => {
            const offset = tsc.index >> idx ^ 1
            const leaf: MerkleLeaf = { offset }
            if (hash === '*') leaf.duplicate = true
            else leaf.hash = hash
            if (idx === 0) {
                if (tsc.index % 2) path.push([leafOfInterest, leaf])
                else path.push([leaf, leafOfInterest])
            }
            else path.push([leaf])
        })
        const merklePath = new MerklePath(blockHeight, path)
        if (header.merkleroot !== merklePath.computeRoot(txid)) throw new Error('Invalid Merkle Path')
        return merklePath
    }

    async getMerklePathOrParents(tx: Transaction): Promise<Transaction> {
        const tscRes = await this.getMerklePath(tx.id('hex'))
        console.log(tscRes)
        if (tscRes !== null) {
            const headerTsc = (Array.isArray(tscRes)) ? tscRes[0] : tscRes
            tx.merklePath = await this.convertTSCtoBUMP(headerTsc)
            console.log({ bump: tx.merklePath })
            return tx
        }
        await Promise.all(tx.inputs.map(async (input, idx) => {
            const rawtx = await this.getTx(input.sourceTXID!)
            const inputTx = Transaction.fromHex(rawtx)
            const st = await this.getMerklePathOrParents(inputTx)
            tx.inputs[idx].sourceTransaction = st
        }))
        return tx
    }
}

export const woc = new WocClient()