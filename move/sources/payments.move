/// SuiSure — merchant payment credentials.
///
/// Scope of this file is MOVE_BUILD_PLAN.md step 3: merchant registration
/// only. `PaymentIntent`, `pay_payment_intent<T>` and the `payment_kit`
/// dependency land in step 4.
module suisure::payments {
    use std::string::String;

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
    /// `payout` is the only address a payment may ever be sent to. Step 4 reads
    /// it from here and never from a caller-supplied parameter — that is the
    /// gap this module exists to close.
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

    /// `init` only runs at publish, so tests need their own way in.
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}
