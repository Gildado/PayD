#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct HelloContract;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[contractimpl]
impl HelloContract {
    /// Returns the contract version as (major, minor, patch).
    pub fn version() -> (u32, u32, u32) {
        (1, 0, 0)
    }

    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}
