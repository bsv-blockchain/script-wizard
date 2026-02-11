import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { woc } from "./woc"
import { TransactionInput, Transaction } from "@bsv/sdk"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function enrich(input: TransactionInput) {
  // this function uses Whatsonchain api to fetch the transaction based on the txid
  const sourceTx = await woc.getBeef(input.sourceTXID!)
  input.sourceTransaction = Transaction.fromHexBEEF(sourceTx);
}