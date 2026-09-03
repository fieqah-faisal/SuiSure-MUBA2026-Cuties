/// SuiSure — merchant payment credentials and payment intents.
///
/// Sui Payment Kit is the cashier; this module is the security guard standing
/// in front of it. Payment Kit's `receiver` is an `Option<address>` supplied by
/// the caller and it does not verify who that is. This module supplies it from
/// the merchant's on-chain `MerchantCredential` instead, which is the entire
/// reason the module exists.
module suisure::payments {
    use std::ascii;
    use std::string::String;
    use std::type_name;
    use sui::clock::Clock;
    use sui::coin::Coin;
    use sui::event;
    use payment_kit::payment_kit::{Self as kit, PaymentRegistry};

    /// The merchant credential is not active.
    const EMerchantInactive: u64 = 1;
    /// The credential passed in is not the one this intent was created against.
    const ECredentialMismatch: u64 = 2;
    /// The payment request has expired.
    const EIntentExpired: u64 = 3;
    /// The payment request has already been paid.
    const EIntentAlreadyPaid: u64 = 4;
    /// Nonce is empty or longer than Payment Kit's 36-character limit.
    const EInvalidNonce: u64 = 5;
    /// Expiry is not in the future.
    const EInvalidExpiry: u64 = 6;

    /// Publisher capability, minted once to the deployer.
    ///
    /// Move has no `msg.sender` modifier. Requiring `&AdminCap` in a function
    /// signature *is* the access check — only the holder can call it.
    public struct AdminCap has key, store {
        id: UID,
    }

    /// A registered merchant.
    ///
    /// Shared, because the customer paying a merchant is a different party and
    /// must be able to read the credential before signing. Shared versus owned
    /// is a one-way decision and cannot be changed after publish.
    ///
    /// `payout` is the only address a payment may ever be sent to. It is read
    /// from here and never from a caller-supplied parameter.
    ///
    /// Business registration numbers and contact emails are deliberately
    /// absent. They must never be written on chain.
    public struct MerchantCredential has key {
        id: UID,
        name: String,
        category: String,
        payout: address,
        active: bool,
    }

    /// A single payment request. Shared, so the paying customer can read it.
    ///
    /// This is *not* Sui's own "Payment Intents" primitive — same word,
    /// different thing. The name matches the existing frontend types.
    ///
    /// `amount` is in the coin's smallest unit and is the figure actually
    /// enforced. `amount_myr` is integer sen for display only (Move has no
    /// floats, so RM12.50 is 1250). `description` and `order_ref` live on chain
    /// so the customer's review screen shows verified state rather than
    /// something handed to it off chain.
    public struct PaymentIntent has key {
        id: UID,
        credential_id: ID,
        amount: u64,
        amount_myr: u64,
        nonce: ascii::String,
        description: String,
        order_ref: String,
        expiry_ms: u64,
        created_at_ms: u64,
        paid: bool,
    }

    public struct PaymentCompleted has copy, drop {
        intent_id: ID,
        credential_id: ID,
        merchant: address,
        amount: u64,
        payer: address,
    }

    /// A receipt the customer actually owns, transferred to the payer.
    ///
    /// Payment Kit's own `PaymentReceipt` cannot be used for this. It has no
    /// `key`, so it is a plain value rather than an object, and every one of its
    /// fields is private with no public accessor, so it cannot even be read.
    /// These fields are therefore built from the values this module verified on
    /// the way through — which is the stronger source anyway, since they are the
    /// ones the asserts above were checked against.
    public struct SuiSureReceipt has key, store {
        id: UID,
        intent_id: ID,
        credential_id: ID,
        merchant: address,
        merchant_name: String,
        amount: u64,
        amount_myr: u64,
        coin_type: ascii::String,
        nonce: ascii::String,
        payer: address,
        paid_at_ms: u64,
    }

    /// Runs once at publish. Mints the `AdminCap` to the deployer.
    fun init(ctx: &mut TxContext) {
        transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
    }

    /// Registers a merchant and shares the resulting credential.
    public fun register_merchant(
        _: &AdminCap,
        name: String,
        category: String,
        payout: address,
        ctx: &mut TxContext,
    ) {
        transfer::share_object(MerchantCredential {
            id: object::new(ctx),
            name,
            category,
            payout,
            active: true,
        });
    }

    /// Switches a merchant on or off without republishing the package.
    public fun set_merchant_active(
        _: &AdminCap,
        credential: &mut MerchantCredential,
        active: bool,
    ) {
        credential.active = active;
    }

    /// Creates and shares a payment request for a merchant.
    ///
    /// `nonce` must be a fresh UUIDv4 generated per intent, not the object's
    /// own ID: Payment Kit caps nonces at 36 characters and a Sui object ID is
    /// 66. It is validated here rather than at payment time so a bad nonce
    /// fails when the merchant creates the QR, not when a customer tries to pay
    /// an intent that could never have succeeded.
    ///
    /// Anyone may call this against a shared credential. That is not a hole:
    /// funds still go only to `credential.payout`, so the worst case is an
    /// unwanted request to pay the merchant.
    public fun create_payment_intent(
        credential: &MerchantCredential,
        amount: u64,
        amount_myr: u64,
        nonce: ascii::String,
        description: String,
        order_ref: String,
        expiry_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(credential.active, EMerchantInactive);
        let nonce_len = nonce.length();
        assert!(nonce_len > 0 && nonce_len <= 36, EInvalidNonce);
        let now_ms = clock.timestamp_ms();
        assert!(expiry_ms > now_ms, EInvalidExpiry);

        transfer::share_object(PaymentIntent {
            id: object::new(ctx),
            credential_id: object::id(credential),
            amount,
            amount_myr,
            nonce,
            description,
            order_ref,
            expiry_ms,
            created_at_ms: now_ms,
            paid: false,
        });
    }

    /// Pays a payment request, generic over the coin type.
    ///
    /// The order of the checks is deliberate and must not be rearranged.
    public fun pay_payment_intent<T>(
        credential: &MerchantCredential,
        intent: &mut PaymentIntent,
        registry: &mut PaymentRegistry,
        coin: Coin<T>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // 1. The merchant must still be trading.
        assert!(credential.active, EMerchantInactive);
        // 2. The credential must be the one this intent was created against —
        //    otherwise a caller could pass a different merchant's credential
        //    and redirect the payout.
        assert!(intent.credential_id == object::id(credential), ECredentialMismatch);
        // 3. Expiry is ours to enforce. Payment Kit's own expiration setting
        //    governs deleting old records, not whether a request is still valid.
        assert!(clock.timestamp_ms() < intent.expiry_ms, EIntentExpired);
        // 4. Payment Kit also blocks duplicates, but keeping our own flag makes
        //    the failure legible on screen.
        assert!(!intent.paid, EIntentAlreadyPaid);

        // 5. The payout address comes from the credential. Never a parameter,
        //    never the caller, never the QR.
        let payout = credential.payout;
        let intent_id = object::id(intent);

        // 6. Hand off to the cashier. The receipt is droppable; the registry
        //    keeps the authoritative payment record.
        let _ = kit::process_registry_payment<T>(
            registry,
            intent.nonce,
            intent.amount,
            coin,
            option::some(payout),
            clock,
            ctx,
        );

        // 7. Mark paid.
        intent.paid = true;

        // 8. Emit.
        event::emit(PaymentCompleted {
            intent_id,
            credential_id: intent.credential_id,
            merchant: payout,
            amount: intent.amount,
            payer: ctx.sender(),
        });

        // 9. Hand the customer an object they own as proof of payment.
        transfer::transfer(
            SuiSureReceipt {
                id: object::new(ctx),
                intent_id,
                credential_id: intent.credential_id,
                merchant: payout,
                merchant_name: credential.name,
                amount: intent.amount,
                amount_myr: intent.amount_myr,
                coin_type: type_name::with_defining_ids<T>().into_string(),
                nonce: intent.nonce,
                payer: ctx.sender(),
                paid_at_ms: clock.timestamp_ms(),
            },
            ctx.sender(),
        );
    }

    public fun name(credential: &MerchantCredential): String {
        credential.name
    }

    public fun category(credential: &MerchantCredential): String {
        credential.category
    }

    public fun payout(credential: &MerchantCredential): address {
        credential.payout
    }

    public fun is_active(credential: &MerchantCredential): bool {
        credential.active
    }

    public fun intent_credential_id(intent: &PaymentIntent): ID {
        intent.credential_id
    }

    public fun intent_amount(intent: &PaymentIntent): u64 {
        intent.amount
    }

    public fun intent_amount_myr(intent: &PaymentIntent): u64 {
        intent.amount_myr
    }

    public fun intent_nonce(intent: &PaymentIntent): ascii::String {
        intent.nonce
    }

    public fun intent_expiry_ms(intent: &PaymentIntent): u64 {
        intent.expiry_ms
    }

    public fun intent_created_at_ms(intent: &PaymentIntent): u64 {
        intent.created_at_ms
    }

    public fun intent_is_paid(intent: &PaymentIntent): bool {
        intent.paid
    }

    public fun receipt_intent_id(receipt: &SuiSureReceipt): ID {
        receipt.intent_id
    }

    public fun receipt_merchant(receipt: &SuiSureReceipt): address {
        receipt.merchant
    }

    public fun receipt_amount(receipt: &SuiSureReceipt): u64 {
        receipt.amount
    }

    public fun receipt_payer(receipt: &SuiSureReceipt): address {
        receipt.payer
    }

    public fun receipt_coin_type(receipt: &SuiSureReceipt): ascii::String {
        receipt.coin_type
    }

    /// `init` only runs at publish, so tests need their own way in.
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}
