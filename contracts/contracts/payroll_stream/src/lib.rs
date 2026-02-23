#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Vec, symbol_short, token};

mod errors;
mod storage;
mod types;

use errors::StreamError;
use storage::{
    get_admin, has_admin, set_admin, get_stream_count, set_stream_count,
    get_stream, set_stream, add_sender_stream, add_recipient_stream,
    get_sender_streams, get_recipient_streams,
};
use types::{PayrollStream, StreamStatus, CreateStreamParams};

#[contract]
pub struct PayrollStreamContract;

#[contractimpl]
impl PayrollStreamContract {
    /// Initialize the payroll stream contract with an organization admin.
    pub fn initialize(env: Env, admin: Address) -> Result<(), StreamError> {
        if has_admin(&env) {
            return Err(StreamError::AlreadyInitialized);
        }
        admin.require_auth();
        set_admin(&env, &admin);
        set_stream_count(&env, 0);

        env.events().publish(
            (symbol_short!("init"),),
            admin.clone(),
        );

        Ok(())
    }

    /// Create a new payment stream to an employee/recipient.
    /// Tokens are linearly streamed from `start_time` to `end_time`.
    pub fn create_stream(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        total_amount: i128,
        start_time: u64,
        end_time: u64,
    ) -> Result<u32, StreamError> {
        if !has_admin(&env) {
            return Err(StreamError::NotInitialized);
        }
        sender.require_auth();

        if sender == recipient {
            return Err(StreamError::InvalidRecipient);
        }
        if total_amount <= 0 {
            return Err(StreamError::InvalidAmount);
        }
        if end_time <= start_time {
            return Err(StreamError::InvalidDuration);
        }
        if start_time < env.ledger().timestamp() {
            return Err(StreamError::InvalidStartTime);
        }

        let duration = end_time - start_time;
        let rate_per_second = total_amount / (duration as i128);

        token::Client::new(&env, &token).transfer(&sender, &env.current_contract_address(), &total_amount);

        let stream_id = get_stream_count(&env);
        let stream = PayrollStream {
            id: stream_id,
            sender: sender.clone(),
            recipient: recipient.clone(),
            token,
            total_amount,
            claimed_amount: 0,
            start_time,
            end_time,
            last_claim_time: start_time,
            status: StreamStatus::Active,
            rate_per_second,
        };

        set_stream(&env, stream_id, &stream);
        set_stream_count(&env, stream_id + 1);
        add_sender_stream(&env, &sender, stream_id);
        add_recipient_stream(&env, &recipient, stream_id);

        env.events().publish(
            (symbol_short!("s_create"), sender.clone()),
            stream_id,
        );

        Ok(stream_id)
    }

    /// Create multiple payment streams in a single transaction.
    /// Emits a single batch event with all created stream IDs.
    pub fn create_batch_streams(
        env: Env,
        sender: Address,
        streams: Vec<CreateStreamParams>,
    ) -> Result<Vec<u32>, StreamError> {
        if !has_admin(&env) {
            return Err(StreamError::NotInitialized);
        }
        sender.require_auth();

        let mut stream_ids: Vec<u32> = Vec::new(&env);
        let mut count = get_stream_count(&env);

        for stream_params in streams.iter() {
            let recipient = stream_params.recipient;
            let token = stream_params.token;
            let total_amount = stream_params.total_amount;
            let start_time = stream_params.start_time;
            let end_time = stream_params.end_time;

            if sender == recipient {
                return Err(StreamError::InvalidRecipient);
            }
            if total_amount <= 0 {
                return Err(StreamError::InvalidAmount);
            }
            if end_time <= start_time {
                return Err(StreamError::InvalidDuration);
            }
            if start_time < env.ledger().timestamp() {
                return Err(StreamError::InvalidStartTime);
            }

            let duration = end_time - start_time;
            let rate_per_second = total_amount / (duration as i128);

            token::Client::new(&env, &token).transfer(&sender, &env.current_contract_address(), &total_amount);
            
            let stream_id = count;
            let stream = PayrollStream {
                id: stream_id,
                sender: sender.clone(),
                recipient: recipient.clone(),
                token: token.clone(),
                total_amount,
                claimed_amount: 0,
                start_time,
                end_time,
                last_claim_time: start_time,
                status: StreamStatus::Active,
                rate_per_second,
            };

            
            set_stream(&env, stream_id, &stream);
            add_sender_stream(&env, &sender, stream_id);
            add_recipient_stream(&env, &recipient, stream_id);
            
            stream_ids.push_back(stream_id);
            count += 1;
        }

        set_stream_count(&env, count);

        env.events().publish(
            (symbol_short!("b_create"), sender.clone()),
            stream_ids.clone(),
        );

        Ok(stream_ids)
    }

    /// Claim accrued tokens from an active stream.
    /// The recipient can claim at any point — they receive tokens proportional to elapsed time.
    pub fn claim(env: Env, recipient: Address, stream_id: u32) -> Result<i128, StreamError> {
        if !has_admin(&env) {
            return Err(StreamError::NotInitialized);
        }
        recipient.require_auth();

        let mut stream = get_stream(&env, stream_id)
            .ok_or(StreamError::StreamNotFound)?;

        if stream.recipient != recipient {
            return Err(StreamError::Unauthorized);
        }
        if stream.status == StreamStatus::Cancelled {
            return Err(StreamError::StreamAlreadyCancelled);
        }
        if stream.status == StreamStatus::Completed {
            return Err(StreamError::StreamCompleted);
        }

        let claimable = Self::calculate_claimable(&env, &stream);
        if claimable <= 0 {
            return Err(StreamError::NothingToClaim);
        }

        stream.claimed_amount += claimable;
        let now = env.ledger().timestamp();
        stream.last_claim_time = now;

        // Check if stream is fully claimed
        if stream.claimed_amount >= stream.total_amount {
            stream.status = StreamStatus::Completed;
        }

        token::Client::new(&env, &stream.token)
            .transfer(&env.current_contract_address(), &recipient, &claimable);

        set_stream(&env, stream_id, &stream);

        env.events().publish(
            (symbol_short!("claim"), recipient.clone()),
            claimable,
        );

        Ok(claimable)
    }

    /// Cancel a stream. Only the sender (organization) can cancel.
    /// Unclaimed tokens are returned to the sender. Already-claimed tokens stay with recipient.
    pub fn cancel_stream(
        env: Env,
        sender: Address,
        stream_id: u32,
    ) -> Result<(), StreamError> {
        if !has_admin(&env) {
            return Err(StreamError::NotInitialized);
        }
        sender.require_auth();

        let mut stream = get_stream(&env, stream_id)
            .ok_or(StreamError::StreamNotFound)?;

        if stream.sender != sender {
            return Err(StreamError::Unauthorized);
        }
        if stream.status == StreamStatus::Cancelled {
            return Err(StreamError::StreamAlreadyCancelled);
        }
        if stream.status == StreamStatus::Completed {
            return Err(StreamError::StreamCompleted);
        }

        // Calculate what recipient is owed up to now
        let claimable = Self::calculate_claimable(&env, &stream);
        let refund = stream.total_amount - stream.claimed_amount - claimable;

        stream.status = StreamStatus::Cancelled;
        let contract_addr = env.current_contract_address();
        let token_client = token::Client::new(&env, &stream.token);

        if claimable > 0 {
            token_client.transfer(&contract_addr, &stream.recipient, &claimable);
        }
        if refund > 0 {
            token_client.transfer(&contract_addr, &sender, &refund);
        }

        set_stream(&env, stream_id, &stream);

        env.events().publish(
            (symbol_short!("cancel"), sender.clone()),
            stream_id,
        );

        Ok(())
    }

    // ── Internal Helpers ─────────────────────────────────────────

    /// Calculate the amount of tokens claimable by the recipient at the current time.
    fn calculate_claimable(env: &Env, stream: &PayrollStream) -> i128 {
        let now = env.ledger().timestamp();

        if now <= stream.start_time {
            return 0;
        }

        let effective_time = if now >= stream.end_time {
            stream.end_time
        } else {
            now
        };

        let elapsed = effective_time - stream.start_time;
        // Check if stream is completed to avoid division by zero (though duration checked at creation)
        if stream.end_time <= stream.start_time {
             return 0; 
        }
        
        // Recalculate based on total amount and duration to minimize rounding errors
        // Instead of using stored rate_per_second which might have rounding loss
        let duration = stream.end_time - stream.start_time;
        let total_accrued = (stream.total_amount * (elapsed as i128)) / (duration as i128);

        // Clamp to total_amount
        let total_accrued = if total_accrued > stream.total_amount {
            stream.total_amount
        } else {
            total_accrued
        };
        
        // Ensure we don't return negative claimable if something is wrong with state
        if total_accrued < stream.claimed_amount {
            return 0;
        }

        total_accrued - stream.claimed_amount
    }

    // ── Query Functions ──────────────────────────────────────────

    /// Get a specific stream by ID.
    pub fn get_stream(env: Env, stream_id: u32) -> Result<PayrollStream, StreamError> {
        get_stream(&env, stream_id).ok_or(StreamError::StreamNotFound)
    }

    /// Get the claimable balance for a stream at the current time.
    pub fn get_claimable(env: Env, stream_id: u32) -> Result<i128, StreamError> {
        let stream = get_stream(&env, stream_id)
            .ok_or(StreamError::StreamNotFound)?;
        Ok(Self::calculate_claimable(&env, &stream))
    }

    /// Get the total number of streams created.
    pub fn get_stream_count(env: Env) -> u32 {
        get_stream_count(&env)
    }

    /// Get all stream IDs created by a sender.
    pub fn get_streams_by_sender(env: Env, sender: Address) -> Vec<u32> {
        get_sender_streams(&env, &sender)
    }

    /// Get all stream IDs where the address is a recipient.
    pub fn get_streams_by_recipient(env: Env, recipient: Address) -> Vec<u32> {
        get_recipient_streams(&env, &recipient)
    }

    /// Get the admin address.
    pub fn get_admin(env: Env) -> Result<Address, StreamError> {
        if !has_admin(&env) {
            return Err(StreamError::NotInitialized);
        }
        Ok(get_admin(&env))
    }

    /// Upgrade the contract WASM. Restricted to admin.
    pub fn upgrade(env: Env, admin: Address, new_wasm_hash: soroban_sdk::BytesN<32>) -> Result<(), StreamError> {
        let stored_admin = get_admin(&env);
        if admin != stored_admin {
            return Err(StreamError::Unauthorized);
        }
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }
}

mod test;
