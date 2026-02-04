import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CA276HNZKSYAL6X5IH6VSZ4UC6V7AGRG3FAGOD2YDIO2ZVVB5REY4UXK",
  }
} as const


export interface Client {
  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit tokens into the vault and start earning yield.
   */
  deposit: ({from, token_id, amount}: {from: string, token_id: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw tokens from the vault.
   */
  withdraw: ({to, token_id, amount}: {to: string, token_id: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check a user's current balance for a specific token in the vault.
   */
  get_balance: ({user, token_id}: {user: string, token_id: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a swap_to_yield transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Swap locked EURC for yield-bearing assets.
   * In production, this would interact with a protocol like Blend or yEURC.
   */
  swap_to_yield: ({user, token_id, amount}: {user: string, token_id: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_yield_estimate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Calculate simulated yield based on time elapsed (approx 4.2% APY).
   */
  get_yield_estimate: ({user}: {user: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAADZEZXBvc2l0IHRva2VucyBpbnRvIHRoZSB2YXVsdCBhbmQgc3RhcnQgZWFybmluZyB5aWVsZC4AAAAAAAdkZXBvc2l0AAAAAAMAAAAAAAAABGZyb20AAAATAAAAAAAAAAh0b2tlbl9pZAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAB9XaXRoZHJhdyB0b2tlbnMgZnJvbSB0aGUgdmF1bHQuAAAAAAh3aXRoZHJhdwAAAAMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAh0b2tlbl9pZAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAEFDaGVjayBhIHVzZXIncyBjdXJyZW50IGJhbGFuY2UgZm9yIGEgc3BlY2lmaWMgdG9rZW4gaW4gdGhlIHZhdWx0LgAAAAAAAAtnZXRfYmFsYW5jZQAAAAACAAAAAAAAAAR1c2VyAAAAEwAAAAAAAAAIdG9rZW5faWQAAAATAAAAAQAAAAs=",
        "AAAAAAAAAHJTd2FwIGxvY2tlZCBFVVJDIGZvciB5aWVsZC1iZWFyaW5nIGFzc2V0cy4KSW4gcHJvZHVjdGlvbiwgdGhpcyB3b3VsZCBpbnRlcmFjdCB3aXRoIGEgcHJvdG9jb2wgbGlrZSBCbGVuZCBvciB5RVVSQy4AAAAAAA1zd2FwX3RvX3lpZWxkAAAAAAAAAwAAAAAAAAAEdXNlcgAAABMAAAAAAAAACHRva2VuX2lkAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAA==",
        "AAAAAAAAAEJDYWxjdWxhdGUgc2ltdWxhdGVkIHlpZWxkIGJhc2VkIG9uIHRpbWUgZWxhcHNlZCAoYXBwcm94IDQuMiUgQVBZKS4AAAAAABJnZXRfeWllbGRfZXN0aW1hdGUAAAAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAAAs=" ]),
      options
    )
  }
  public readonly fromJSON = {
    deposit: this.txFromJSON<null>,
        withdraw: this.txFromJSON<null>,
        get_balance: this.txFromJSON<i128>,
        swap_to_yield: this.txFromJSON<null>,
        get_yield_estimate: this.txFromJSON<i128>
  }
}