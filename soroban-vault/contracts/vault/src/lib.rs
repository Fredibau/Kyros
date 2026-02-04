#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, token, symbol_short, Symbol};

// We use these Keys to store data in the contract's storage.
const BALANCE: Symbol = symbol_short!("BAL");
const YIELD_UNITS: Symbol = symbol_short!("YUNIT");
const LAST_SYNC: Symbol = symbol_short!("LSYNC");

#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    /// Deposit tokens into the vault and start earning yield.
    pub fn deposit(env: Env, from: Address, token_id: Address, amount: i128) {
        from.require_auth();

        let client = token::Client::new(&env, &token_id);
        client.transfer(&from, &env.current_contract_address(), &amount);

        // Update the user's core balance for THIS SPECIFIC TOKEN
        let key = (BALANCE, token_id.clone(), from.clone());
        let current_balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current_balance + amount));

        // Sync yield units for THIS SPECIFIC TOKEN
        let yield_key = (YIELD_UNITS, token_id, from.clone());
        let current_units: i128 = env.storage().persistent().get(&yield_key).unwrap_or(0);
        env.storage().persistent().set(&yield_key, &(current_units + amount));
        
        // Record timestamp for yield calculation
        let sync_key = (LAST_SYNC, from);
        env.storage().persistent().set(&sync_key, &env.ledger().timestamp());
    }

    /// Calculate simulated yield based on time elapsed (approx 4.2% APY).
    pub fn get_yield_estimate(env: Env, user: Address) -> i128 {
        let sync_key = (LAST_SYNC, user.clone());
        let last_sync: u64 = env.storage().persistent().get(&sync_key).unwrap_or(0);
        
        if last_sync == 0 { return 0; }

        let yield_key = (YIELD_UNITS, user);
        let units: i128 = env.storage().persistent().get(&yield_key).unwrap_or(0);

        let elapsed_seconds = env.ledger().timestamp() - last_sync;
        
        // Simulating 4.2% APY: (units * 0.042 * elapsed) / seconds_in_year
        // Using integer math for Soroban (scaling by 1,000,000)
        let apy_scaled = 42000; // 0.042 * 1,000,000
        let year_seconds = 31536000;
        
        (units * apy_scaled * elapsed_seconds as i128) / (year_seconds * 1000000)
    }

    /// Withdraw tokens from the vault.
    pub fn withdraw(env: Env, to: Address, token_id: Address, amount: i128) {
        // 1. Verify the requester is the owner of the funds.
        to.require_auth();

        let key = (BALANCE, token_id.clone(), to.clone());
        let current_balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);

        // 2. Safety Check: Ensure the user isn't trying to withdraw more than they have.
        if amount > current_balance {
            panic!("Insufficient balance in vault");
        }

        // 3. Update Storage: We subtract the amount FIRST.
        // This is a "Check-Effect-Interaction" pattern which is a best practice 
        // in smart contracts to prevent certain types of attacks.
        env.storage().persistent().set(&key, &(current_balance - amount));

        // 4. Interaction: Send the tokens from the contract back to the user.
        let client = token::Client::new(&env, &token_id);
        client.transfer(&env.current_contract_address(), &to, &amount);
    }

    /// Check a user's current balance for a specific token in the vault.
    pub fn get_balance(env: Env, user: Address, token_id: Address) -> i128 {
        let key = (BALANCE, token_id, user);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Swap locked EURC for yield-bearing assets.
    /// In production, this would interact with a protocol like Blend or yEURC.
    pub fn swap_to_yield(env: Env, user: Address, token_id: Address, amount: i128) {
        user.require_auth();

        let key = (BALANCE, token_id.clone(), user.clone());
        let current_balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);

        if amount > current_balance {
            panic!("Insufficient balance to swap");
        }

        // Logic for swapping EURC -> yEURC would go here.
        // For the MVP, we simulate this by marking the funds as "yielding".
        // In a real scenario, this would call another contract.
        
        // env.storage().persistent().set(&key, &(current_balance - amount));
        // let yield_key = (symbol_short!("YIELD"), user);
        // let current_yield: i128 = env.storage().persistent().get(&yield_key).unwrap_or(0);
        // env.storage().persistent().set(&yield_key, &(current_yield + amount));
    }
}

mod test;
