import * as web3 from '@solana/web3.js'
import * as fs from 'fs'
import dotenv from 'dotenv'

dotenv.config()

const PROGRAM_ID = new web3.PublicKey("ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa")
const PROGRAM_DATA_PUBLIC_KEY = new web3.PublicKey("Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod")

async function airdropSOLIfNeeded(signer: web3.Keypair, connection: web3.Connection) {
    const balance = await connection.getBalance(signer.publicKey)
    console.log('Current balance =', balance / web3.LAMPORTS_PER_SOL, 'SOL')

    if (balance / web3.LAMPORTS_PER_SOL < 1) {
        console.log('Airdropping 1 SOL ...')
        const airdropSignature = await connection.requestAirdrop(
            signer.publicKey,
            web3.LAMPORTS_PER_SOL
        )

        const latestBlockhash = await connection.getLatestBlockhash()

        await connection.confirmTransaction({
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            signature: airdropSignature
        })

        const newBalance = await connection.getBalance(signer.publicKey)
        console.log('New balance is', newBalance / web3.LAMPORTS_PER_SOL, 'SOL')

    }
}
async function initializeKeypair(connection: web3.Connection): Promise<web3.Keypair> {
    if  (!process.env.PRIVATE_KEY) {
        console.log('Generating new key pair ...')
        const signer = web3.Keypair.generate();
        // request airdrop
        await airdropSOLIfNeeded(signer, connection)

        console.log('Creating .env file')
        fs.writeFileSync('.env', `PRIVATE_KEY=[${signer.secretKey.toString()}]`)

        return signer
    }

    const secret = JSON.parse(process.env.PRIVATE_KEY ?? '') as number[]
    const secretKey = Uint8Array.from(secret)
    const keypairFromSecret = web3.Keypair.fromSecretKey(secretKey)
        // request airdrop
    await airdropSOLIfNeeded(keypairFromSecret, connection)
    return keypairFromSecret
}

async function pingProgram(connection: web3.Connection, payer: web3.Keypair) {
    const transaction = new web3.Transaction()
    const instruction = new web3.TransactionInstruction({
        keys: [
            {
                pubkey: PROGRAM_DATA_PUBLIC_KEY,
                isSigner: false,
                isWritable: true
            }
        ],
        programId: PROGRAM_ID
    })

    transaction.add(instruction)
    const transactionSignature = await web3.sendAndConfirmTransaction(connection, transaction, [payer])
}

async function transferSOL(connection:web3.Connection, from: web3.Keypair, to: web3.PublicKey, value: number) {
    const transaction  = new web3.Transaction()
    transaction.add(
        web3.SystemProgram.transfer({
            fromPubkey: from.publicKey,
            toPubkey: to,
            lamports: value * web3.LAMPORTS_PER_SOL
        }),
    )

    const tx = await web3.sendAndConfirmTransaction(connection, transaction, [from])
    console.log(tx)
    
}

async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl('devnet'))
    const signer = await initializeKeypair(connection)
    console.log('Public key:', signer.publicKey.toBase58())

    await pingProgram(connection, signer)

    const toPubkey = new web3.PublicKey('4XyZF4Po9uUL2Wzt6A89ZL4NYnTBpbL7yP3UkK5rS6hp')
    await transferSOL(connection, signer, toPubkey, 0.1)
}

main()
    .then(() => {
        console.log("Finished successfully")
        process.exit(0)
    })
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })
