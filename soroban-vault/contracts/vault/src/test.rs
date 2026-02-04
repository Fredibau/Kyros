#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _};
use soroban_sdk::{token, Env, Address};

#[test]
fn test_vault_deposit_and_withdraw() {
    // 1. Setup the Soroban Environment
    let env = Env::default();
    env.mock_all_auths(); // Automatically mock signatures for tests

    // 2. Register the Vault Contract
    let contract_id = env.register(VaultContract, ());
    let client = VaultContractClient::new(&env, &contract_id);

    // 3. Create a mock token to act as "USDC" or "XLM"
    let admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
    let token_id = token_contract.address();
    let token_client = token::StellarAssetClient::new(&env, &token_id);
    let token_admin_client = token::Client::new(&env, &token_id);

    // 4. Setup a User with some initial tokens
    let user = Address::generate(&env);
    token_client.mint(&user, &1000);
    assert_eq!(token_admin_client.balance(&user), 1000);

    // 5. TEST DEPOSIT
    client.deposit(&user, &token_id, &400);

    // Check: Did the vault contract receive the tokens?
    assert_eq!(token_admin_client.balance(&contract_id), 400);
    // Check: Does the user's vault balance reflect the deposit?
    assert_eq!(client.get_balance(&user, &token_id), 400);
    // Check: Did the user's wallet balance decrease?
    assert_eq!(token_admin_client.balance(&user), 600);

    // 6. TEST WITHDRAW
    client.withdraw(&user, &token_id, &150);

    // Check: Did the vault send the tokens back?
    assert_eq!(token_admin_client.balance(&contract_id), 250);
    // Check: Is the vault balance updated?
    assert_eq!(client.get_balance(&user, &token_id), 250);
    // Check: Did the user's wallet balance increase?
    assert_eq!(token_admin_client.balance(&user), 750);
}

#[test]
#[should_panic(expected = "Insufficient balance in vault")]
fn test_withdraw_insufficient_funds() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultContract, ());
    let client = VaultContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
    let token_id = token_contract.address();
    let token_client = token::StellarAssetClient::new(&env, &token_id);

    let user = Address::generate(&env);
    token_client.mint(&user, &1000);

    client.deposit(&user, &token_id, &100);
    
    // This should trigger the panic we defined in lib.rs
    client.withdraw(&user, &token_id, &200);
}
